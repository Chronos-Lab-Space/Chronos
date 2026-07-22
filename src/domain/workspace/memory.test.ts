import { describe, expect, it } from "vitest";
import {
  buildReport,
  compareSimulations,
  groupByLineage,
  versionLabel,
  versionsFor,
} from "./memory";
import type { FutureRecord, SimulationRecord, WorkspaceHome } from "./types";

function sim(partial: Partial<SimulationRecord> & Pick<SimulationRecord, "id" | "version" | "lineage_id">): SimulationRecord {
  return {
    workspace_id: "w1",
    goal_id: null,
    title: "Should we raise?",
    status: "completed",
    confidence: 0.8,
    result: { best_future: "Bootstrap", recommendation: "Bootstrap first" },
    created_at: "2026-01-01T00:00:00.000Z",
    parent_simulation_id: null,
    ...partial,
  };
}

describe("persistent memory (history)", () => {
  it("groups simulations into version lineages", () => {
    const sims = [
      sim({ id: "s1", version: 1, lineage_id: "L1", created_at: "2026-01-01T00:00:00.000Z" }),
      sim({ id: "s2", version: 2, lineage_id: "L1", parent_simulation_id: "s1", created_at: "2026-01-02T00:00:00.000Z", confidence: 0.85 }),
      sim({ id: "s3", version: 1, lineage_id: "L2", title: "Launch API", created_at: "2026-01-03T00:00:00.000Z" }),
    ];
    const groups = groupByLineage(sims);
    expect(groups).toHaveLength(2);
    expect(groups[0].lineage_id).toBe("L2"); // newest lineage first
    const l1 = groups.find((g) => g.lineage_id === "L1")!;
    expect(l1.versions.map((v) => v.version)).toEqual([2, 1]);
    expect(l1.latest.id).toBe("s2");
    expect(versionLabel(l1.latest)).toBe("v2");
  });

  it("lists versions for a simulation id", () => {
    const sims = [
      sim({ id: "s1", version: 1, lineage_id: "L1" }),
      sim({ id: "s2", version: 2, lineage_id: "L1", parent_simulation_id: "s1" }),
    ];
    expect(versionsFor(sims, "s1").map((v) => v.id)).toEqual(["s1", "s2"]);
  });

  it("builds a reopenable report and compares versions", () => {
    const left = sim({
      id: "s1",
      version: 1,
      lineage_id: "L1",
      confidence: 0.7,
      result: { best_future: "Bootstrap", recommendation: "Stay lean" },
    });
    const right = sim({
      id: "s2",
      version: 2,
      lineage_id: "L1",
      parent_simulation_id: "s1",
      confidence: 0.9,
      result: { best_future: "Partner-led path", recommendation: "Partner first" },
    });
    const home: WorkspaceHome = {
      workspace: {
        id: "w1",
        owner_id: "u",
        name: "Chronos Lab",
        description: "",
        created_at: "2026-01-01T00:00:00.000Z",
      },
      goal: null,
      goalHistory: [],
      recentSimulations: [right, left],
      knowledge: [],
      notes: [],
      futuresBySimulation: {
        s1: [{ id: "f1", simulation_id: "s1", name: "Bootstrap", score: 0.7, risk: 0.2, confidence: 0.7, summary: "lean" }],
        s2: [{ id: "f2", simulation_id: "s2", name: "Partner-led path", score: 0.9, risk: 0.3, confidence: 0.9, summary: "distro" }],
      },
      timelineBySimulation: {},
    };

    const report = buildReport(home, "s2");
    expect(report?.workspace_name).toBe("Chronos Lab");
    expect(report?.recommendation).toContain("Partner");
    expect(report?.futures).toHaveLength(1);

    const cmp = compareSimulations(
      left,
      right,
      home.futuresBySimulation.s1 as FutureRecord[],
      home.futuresBySimulation.s2 as FutureRecord[]
    );
    expect(cmp.sameLineage).toBe(true);
    expect(cmp.bestFutureChanged).toBe(true);
    expect(cmp.confidenceDelta).toBeCloseTo(0.2);
  });
});
