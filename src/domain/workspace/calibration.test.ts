import { describe, expect, it } from "vitest";
import { SimulationEngine } from "../../application/simulation/SimulationEngine";
import {
  CALIBRATION_BANDS,
  CALIBRATION_MIN_SAMPLE,
  caveatForConfidence,
  deriveCalibration,
  formatConfidenceCaveat,
} from "./calibration";
import type { OutcomeFollowed, OutcomeVerdict, SimulationRecord, WorkspaceHome } from "./types";

const WS = "11111111-1111-4111-8111-111111111111";
const LINEAGE_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const LINEAGE_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

let seq = 0;
function simId(): string {
  seq += 1;
  return `00000000-0000-4000-8000-${String(seq).padStart(12, "0")}`;
}

/** A completed run with a confidence and, optionally, a logged outcome. */
function run(partial: {
  confidence: number | null;
  followed?: OutcomeFollowed | null;
  verdict?: OutcomeVerdict | null;
  lineage?: string;
  version?: number;
  id?: string;
  status?: SimulationRecord["status"];
}): SimulationRecord {
  const id = partial.id ?? simId();
  return {
    id,
    workspace_id: WS,
    goal_id: null,
    title: "How should we launch?",
    status: partial.status ?? "completed",
    confidence: partial.confidence,
    result: {
      outcome_followed: partial.followed ?? null,
      outcome_verdict: partial.verdict ?? null,
    },
    created_at: "2026-01-01T00:00:00.000Z",
    version: partial.version ?? 1,
    lineage_id: partial.lineage ?? id,
    parent_simulation_id: null,
    decision_id: partial.lineage ?? id,
  };
}

function home(sims: readonly SimulationRecord[]): WorkspaceHome {
  return {
    workspace: {
      id: WS,
      owner_id: "u1",
      name: "Lab",
      description: "",
      created_at: "2026-01-01T00:00:00.000Z",
    },
    goal: null,
    goalHistory: [],
    recentSimulations: sims,
    decisions: [],
    knowledge: [],
    notes: [],
    futuresBySimulation: {},
    timelineBySimulation: {},
  };
}

/** n followed runs in one band, `hits` of which landed as predicted or better. */
function band(confidence: number, n: number, hits: number): SimulationRecord[] {
  return Array.from({ length: n }, (_, i) =>
    run({ confidence, followed: "yes", verdict: i < hits ? "as_expected" : "worse" })
  );
}

function bandAt(result: ReturnType<typeof deriveCalibration>, label: string) {
  const found = result.bands.find((b) => b.label === label);
  if (!found) throw new Error(`no band labelled ${label}`);
  return found;
}

describe("deriveCalibration — the honest denominator", () => {
  it("excludes not-followed runs rather than counting them as misses", () => {
    // The whole point: five runs the user never took must not make Chronos
    // look wrong. Same reasoning that puts notFollowed at 0.5, not 0.
    const result = deriveCalibration(
      home([
        ...band(0.9, CALIBRATION_MIN_SAMPLE, CALIBRATION_MIN_SAMPLE),
        ...Array.from({ length: 5 }, () =>
          run({ confidence: 0.9, followed: "no", verdict: "worse" })
        ),
      ])
    );

    const top = bandAt(result, "85–100%");
    expect(top.n).toBe(CALIBRATION_MIN_SAMPLE);
    expect(top.rate).toBe(1);
    expect(result.excludedNotFollowed).toBe(5);
  });

  it("counts a partially-followed run, and reports how many were partial", () => {
    const result = deriveCalibration(
      home([
        ...band(0.9, CALIBRATION_MIN_SAMPLE - 1, CALIBRATION_MIN_SAMPLE - 1),
        run({ confidence: 0.9, followed: "partially", verdict: "worse" }),
      ])
    );

    const top = bandAt(result, "85–100%");
    expect(top.n).toBe(CALIBRATION_MIN_SAMPLE);
    expect(top.rate).toBeCloseTo((CALIBRATION_MIN_SAMPLE - 1) / CALIBRATION_MIN_SAMPLE, 10);
    expect(result.partialCount).toBe(1);
  });

  it("treats a run with no verdict as no data, not as 'as expected'", () => {
    const result = deriveCalibration(
      home([
        ...band(0.9, CALIBRATION_MIN_SAMPLE, CALIBRATION_MIN_SAMPLE),
        run({ confidence: 0.9, followed: "yes", verdict: null }),
      ])
    );

    expect(bandAt(result, "85–100%").n).toBe(CALIBRATION_MIN_SAMPLE);
    expect(result.unverifiedCount).toBe(1);
  });

  it("ignores runs that never collapsed to a confidence", () => {
    const result = deriveCalibration(
      home([
        run({ confidence: null, followed: "yes", verdict: "as_expected" }),
        run({ confidence: 0.9, followed: "yes", verdict: "as_expected", status: "running" }),
      ])
    );

    expect(result.totalMeasured).toBe(0);
    expect(result.hasData).toBe(false);
  });
});

describe("deriveCalibration — bands, not a curve", () => {
  it("reports no rate at all below the minimum sample size", () => {
    const result = deriveCalibration(home(band(0.9, CALIBRATION_MIN_SAMPLE - 1, 0)));

    const top = bandAt(result, "85–100%");
    expect(top.n).toBe(CALIBRATION_MIN_SAMPLE - 1);
    expect(top.rate).toBeNull();
    expect(top.hasEnoughData).toBe(false);
  });

  it("reports a rate once the band reaches the minimum sample size", () => {
    const result = deriveCalibration(home(band(0.9, CALIBRATION_MIN_SAMPLE, 3)));

    const top = bandAt(result, "85–100%");
    expect(top.hasEnoughData).toBe(true);
    expect(top.rate).toBeCloseTo(3 / CALIBRATION_MIN_SAMPLE, 10);
  });

  it("always exposes n, even when it withholds the rate", () => {
    const result = deriveCalibration(home(band(0.6, 2, 1)));
    for (const b of result.bands) {
      expect(typeof b.n).toBe("number");
    }
    expect(bandAt(result, "50–69%").n).toBe(2);
  });

  it("sorts each run into exactly one band, by its boundaries", () => {
    const result = deriveCalibration(
      home([
        run({ confidence: 0.85, followed: "yes", verdict: "as_expected" }),
        run({ confidence: 0.84, followed: "yes", verdict: "as_expected" }),
        run({ confidence: 0.7, followed: "yes", verdict: "as_expected" }),
        run({ confidence: 0.69, followed: "yes", verdict: "as_expected" }),
        run({ confidence: 0.5, followed: "yes", verdict: "as_expected" }),
        run({ confidence: 0.49, followed: "yes", verdict: "as_expected" }),
      ])
    );

    // Each band owns its lower bound: 0.85 is the top band's, 0.84 is not.
    expect(bandAt(result, "85–100%").n).toBe(1); // 0.85
    expect(bandAt(result, "70–84%").n).toBe(2); // 0.84, 0.70
    expect(bandAt(result, "50–69%").n).toBe(2); // 0.69, 0.50
    expect(bandAt(result, "below 50%").n).toBe(1); // 0.49
    expect(result.totalMeasured).toBe(6);
    expect(result.bands.reduce((sum, b) => sum + b.n, 0)).toBe(6);
  });

  it("renders every band it declares, so an empty band is visibly empty", () => {
    const result = deriveCalibration(home([]));
    expect(result.bands).toHaveLength(CALIBRATION_BANDS.length);
    expect(result.bands.every((b) => b.n === 0 && b.rate === null)).toBe(true);
    expect(result.hasData).toBe(false);
  });

  it("counts 'better than predicted' as landing, per the spec's band wording", () => {
    const result = deriveCalibration(
      home(
        Array.from({ length: CALIBRATION_MIN_SAMPLE }, () =>
          run({ confidence: 0.9, followed: "yes", verdict: "better" })
        )
      )
    );

    expect(bandAt(result, "85–100%").rate).toBe(1);
  });
});

describe("deriveCalibration — reproducible by hand", () => {
  it("reports a rate that matches the arithmetic on the fixture", () => {
    // 7 followed runs at 90%: 4 as_expected, 1 better, 2 worse → 5/7.
    const sims = [
      ...Array.from({ length: 4 }, () =>
        run({ confidence: 0.9, followed: "yes", verdict: "as_expected" })
      ),
      run({ confidence: 0.9, followed: "yes", verdict: "better" }),
      ...Array.from({ length: 2 }, () =>
        run({ confidence: 0.9, followed: "yes", verdict: "worse" })
      ),
    ];

    const top = bandAt(deriveCalibration(home(sims)), "85–100%");
    expect(top.n).toBe(7);
    expect(top.landed).toBe(5);
    expect(top.rate).toBeCloseTo(5 / 7, 10);
  });

  it("is pure — same input, same output, and the input is untouched", () => {
    const sims = band(0.9, CALIBRATION_MIN_SAMPLE, 3);
    const snapshot = JSON.stringify(sims);
    const first = deriveCalibration(home(sims));
    const second = deriveCalibration(home(sims));

    expect(second).toEqual(first);
    expect(JSON.stringify(sims)).toBe(snapshot);
  });
});

describe("deriveCalibration — a report on confidence, never an input to it", () => {
  it("leaves engine futures, scores, ranking and confidence byte-identical", () => {
    const engineInput = {
      simulationId: "11111111-1111-4111-8111-111111111111",
      workspaceId: WS,
      goal: null,
      objective: "Should we launch the public beta with a small team? 12 months runway, $8k MRR",
      knowledge: [],
      notes: [],
      constraints: [],
    };
    const engine = new SimulationEngine();
    const before = engine.run(engineInput);

    // Derive calibration over a workspace whose runs carry that confidence,
    // including verdicts that would tempt an implementation to "correct" it.
    deriveCalibration(
      home(
        Array.from({ length: CALIBRATION_MIN_SAMPLE * 2 }, () =>
          run({ confidence: before.confidence, followed: "yes", verdict: "worse" })
        )
      )
    );

    const after = engine.run(engineInput);
    // Same projection the engine's own determinism invariant asserts on: row
    // ids are freshly minted per run by design, everything the user sees is not.
    const ranking = (out: typeof before) => out.futures.map((f) => [f.name, f.score, f.risk]);
    expect(ranking(after)).toEqual(ranking(before));
    expect(after.best.name).toBe(before.best.name);
    expect(after.recommendation).toBe(before.recommendation);
    expect(after.confidence).toBe(before.confidence);
  });

  it("does not read the free-text result, only the explicit verdict", () => {
    const sims = Array.from({ length: CALIBRATION_MIN_SAMPLE }, () =>
      run({ confidence: 0.9, followed: "yes", verdict: "worse" })
    ).map((s) => ({
      ...s,
      result: { ...s.result, outcome_result: "Honestly this went better than predicted!" },
    }));

    // Prose is never interpreted: five 'worse' verdicts stay a 0% band.
    expect(bandAt(deriveCalibration(home(sims)), "85–100%").rate).toBe(0);
  });
});

describe("deriveCalibration — per-decision movement", () => {
  it("reports a decision whose later version landed closer than the earlier one", () => {
    const result = deriveCalibration(
      home([
        run({ confidence: 0.8, followed: "yes", verdict: "worse", lineage: LINEAGE_A, version: 1 }),
        run({
          confidence: 0.8,
          followed: "yes",
          verdict: "as_expected",
          lineage: LINEAGE_A,
          version: 2,
        }),
      ])
    );

    expect(result.movement).toHaveLength(1);
    const [moved] = result.movement;
    expect(moved.decisionId).toBe(LINEAGE_A);
    expect(moved.direction).toBe("closer");
    expect(moved.from.verdict).toBe("worse");
    expect(moved.to.verdict).toBe("as_expected");
  });

  it("treats 'better than predicted' as divergence, not a bullseye", () => {
    // Movement asks how *close* the prediction landed. as_expected is the only
    // bullseye; overshooting is still a miss, in the opposite direction.
    const result = deriveCalibration(
      home([
        run({
          confidence: 0.8,
          followed: "yes",
          verdict: "as_expected",
          lineage: LINEAGE_A,
          version: 1,
        }),
        run({
          confidence: 0.8,
          followed: "yes",
          verdict: "better",
          lineage: LINEAGE_A,
          version: 2,
        }),
      ])
    );

    expect(result.movement[0].direction).toBe("further");
  });

  it("reports no movement when both versions landed the same distance out", () => {
    const result = deriveCalibration(
      home([
        run({ confidence: 0.8, followed: "yes", verdict: "worse", lineage: LINEAGE_A, version: 1 }),
        run({
          confidence: 0.8,
          followed: "yes",
          verdict: "better",
          lineage: LINEAGE_A,
          version: 2,
        }),
      ])
    );

    expect(result.movement[0].direction).toBe("unchanged");
  });

  it("needs both versions followed — one unfollowed version is not a comparison", () => {
    const result = deriveCalibration(
      home([
        run({ confidence: 0.8, followed: "no", verdict: "worse", lineage: LINEAGE_A, version: 1 }),
        run({
          confidence: 0.8,
          followed: "yes",
          verdict: "as_expected",
          lineage: LINEAGE_A,
          version: 2,
        }),
      ])
    );

    expect(result.movement).toEqual([]);
  });

  it("ignores a decision with only one measurable version", () => {
    const result = deriveCalibration(
      home([
        run({ confidence: 0.8, followed: "yes", verdict: "worse", lineage: LINEAGE_A, version: 1 }),
      ])
    );

    expect(result.movement).toEqual([]);
  });

  it("compares the earliest and latest measurable versions of a decision", () => {
    const result = deriveCalibration(
      home([
        run({ confidence: 0.8, followed: "yes", verdict: "worse", lineage: LINEAGE_A, version: 3 }),
        run({
          confidence: 0.8,
          followed: "yes",
          verdict: "better",
          lineage: LINEAGE_A,
          version: 1,
        }),
        run({
          confidence: 0.8,
          followed: "yes",
          verdict: "as_expected",
          lineage: LINEAGE_A,
          version: 2,
        }),
      ])
    );

    expect(result.movement[0].from.version).toBe(1);
    expect(result.movement[0].to.version).toBe(3);
    expect(result.movement[0].direction).toBe("unchanged");
  });

  it("keeps decisions separate", () => {
    const result = deriveCalibration(
      home([
        run({ confidence: 0.8, followed: "yes", verdict: "worse", lineage: LINEAGE_A, version: 1 }),
        run({
          confidence: 0.8,
          followed: "yes",
          verdict: "as_expected",
          lineage: LINEAGE_A,
          version: 2,
        }),
        run({
          confidence: 0.8,
          followed: "yes",
          verdict: "as_expected",
          lineage: LINEAGE_B,
          version: 1,
        }),
        run({ confidence: 0.8, followed: "yes", verdict: "worse", lineage: LINEAGE_B, version: 2 }),
      ])
    );

    expect(result.movement).toHaveLength(2);
    expect(result.movement.map((m) => m.decisionId).sort()).toEqual([LINEAGE_A, LINEAGE_B].sort());
  });

  it("falls back to the lineage when a legacy row has no decision_id", () => {
    const a = run({
      confidence: 0.8,
      followed: "yes",
      verdict: "worse",
      lineage: LINEAGE_A,
      version: 1,
    });
    const b = run({
      confidence: 0.8,
      followed: "yes",
      verdict: "as_expected",
      lineage: LINEAGE_A,
      version: 2,
    });
    const result = deriveCalibration(
      home([
        { ...a, decision_id: null },
        { ...b, decision_id: undefined },
      ])
    );

    expect(result.movement).toHaveLength(1);
    expect(result.movement[0].decisionId).toBe(LINEAGE_A);
  });
});

describe("caveatForConfidence — slice 3", () => {
  it("returns null when the band lacks enough measured runs", () => {
    // Four hits in 70–84% — below CALIBRATION_MIN_SAMPLE.
    const cal = deriveCalibration(home(band(0.75, CALIBRATION_MIN_SAMPLE - 1, 3)));
    expect(caveatForConfidence(cal, 0.78)).toBeNull();
  });

  it("returns the band's rate for a confidence that falls in a measured band", () => {
    // 6 of 8 as_expected in 70–84%.
    const cal = deriveCalibration(home(band(0.8, 8, 6)));
    const caveat = caveatForConfidence(cal, 0.72);
    expect(caveat).not.toBeNull();
    expect(caveat!.bandLabel).toBe("70–84%");
    expect(caveat!.n).toBe(8);
    expect(caveat!.landed).toBe(6);
    expect(caveat!.rate).toBeCloseTo(6 / 8, 10);
  });

  it("does not use another band's rate when this band is empty", () => {
    // Plenty of 85–100% data; none in below 50%.
    const cal = deriveCalibration(home(band(0.9, 8, 4)));
    expect(caveatForConfidence(cal, 0.3)).toBeNull();
    expect(caveatForConfidence(cal, 0.92)?.bandLabel).toBe("85–100%");
  });

  it("formats copy that states self-reported and shows denominator", () => {
    const cal = deriveCalibration(home(band(0.8, 8, 6)));
    const caveat = caveatForConfidence(cal, 0.8)!;
    const text = formatConfidenceCaveat(caveat);
    expect(text).toMatch(/70–84%/);
    expect(text).toMatch(/75%/);
    expect(text).toMatch(/8 measured/);
    expect(text).toMatch(/Self-reported/);
  });

  it("never changes the confidence number it is asked about", () => {
    const cal = deriveCalibration(home(band(0.8, 8, 2)));
    const claimed = 0.81;
    const caveat = caveatForConfidence(cal, claimed);
    // The caveat reports history; the claimed value is the caller's input.
    expect(caveat!.rate).not.toBe(claimed);
    expect(claimed).toBe(0.81);
  });
});
