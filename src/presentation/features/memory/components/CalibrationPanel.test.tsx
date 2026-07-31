import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import type {
  OutcomeFollowed,
  OutcomeVerdict,
  SimulationRecord,
  WorkspaceHome,
} from "../../../../domain/workspace/types";
import { CalibrationPanel } from "./CalibrationPanel";

const WS = "11111111-1111-4111-8111-111111111111";

let seq = 0;
function simId(): string {
  seq += 1;
  return `00000000-0000-4000-8000-${String(seq).padStart(12, "0")}`;
}

function run(partial: {
  confidence: number | null;
  followed?: OutcomeFollowed | null;
  verdict?: OutcomeVerdict | null;
}): SimulationRecord {
  const id = simId();
  return {
    id,
    workspace_id: WS,
    goal_id: null,
    title: "How should we launch?",
    status: "completed",
    confidence: partial.confidence,
    result: {
      outcome_followed: partial.followed ?? null,
      outcome_verdict: partial.verdict ?? null,
    },
    created_at: "2026-01-01T00:00:00.000Z",
    version: 1,
    lineage_id: id,
    parent_simulation_id: null,
    decision_id: id,
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
  } as WorkspaceHome;
}

/** n followed runs at one confidence, `hits` of which landed as predicted. */
function band(confidence: number, n: number, hits: number): SimulationRecord[] {
  return Array.from({ length: n }, (_, i) =>
    run({ confidence, followed: "yes", verdict: i < hits ? "as_expected" : "worse" })
  );
}

function renderPanel(sims: readonly SimulationRecord[]) {
  return render(
    <MemoryRouter>
      <CalibrationPanel home={home(sims)} />
    </MemoryRouter>
  );
}

describe("CalibrationPanel", () => {
  it("invites the user to log an outcome instead of reporting zeroes", () => {
    // A workspace with nothing measured must not render 0% in four bands —
    // that reads as "Chronos is always wrong" rather than "nothing checked".
    renderPanel([run({ confidence: 0.8 })]);

    expect(screen.getByTestId("calibration-empty")).toBeInTheDocument();
    expect(screen.queryByTestId("calibration-bands")).not.toBeInTheDocument();
    expect(screen.queryByText("0%")).not.toBeInTheDocument();
  });

  it("withholds the rate for a band under the minimum sample", () => {
    // Two runs at 100% agreement is noise. Printing "100%" would be the exact
    // failure the spec forbids: a number that looks like information.
    // Asserted on 70–84%, whose label cannot itself contain "100%".
    renderPanel(band(0.75, 2, 2));

    const row = screen.getByTestId("calibration-band-70–84%");
    expect(row).toHaveTextContent(/not yet/i);
    expect(row).not.toHaveTextContent("100%");
  });

  it("reports a rate with its denominator once the band has enough runs", () => {
    renderPanel(band(0.75, 5, 3));

    const row = screen.getByTestId("calibration-band-70–84%");
    expect(row).toHaveTextContent("60%");
    expect(row).toHaveTextContent("5");
  });

  it("reports not-followed runs as excluded rather than counting them as misses", () => {
    // 5 measurable runs at 3 hits, plus 4 runs the user never adopted. The
    // rate must stay 60% — not 3/9 — and the excluded count must be visible.
    renderPanel([
      ...band(0.75, 5, 3),
      ...Array.from({ length: 4 }, () =>
        run({ confidence: 0.75, followed: "no", verdict: "worse" })
      ),
    ]);

    expect(screen.getByTestId("calibration-band-70–84%")).toHaveTextContent("60%");
    expect(screen.getByTestId("calibration-denominators")).toHaveTextContent(/4 not followed/i);
  });

  it("counts a collapsed run with no verdict as awaiting an outcome", () => {
    renderPanel([...band(0.75, 5, 3), run({ confidence: 0.9 }), run({ confidence: 0.4 })]);

    expect(screen.getByTestId("calibration-denominators")).toHaveTextContent(
      /2 awaiting an outcome/i
    );
  });

  it("names the self-reporting limit rather than implying measured accuracy", () => {
    renderPanel(band(0.75, 5, 3));

    expect(screen.getByTestId("calibration-caveat")).toHaveTextContent(/recollection/i);
  });
});
