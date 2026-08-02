import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { CALIBRATION_MIN_SAMPLE } from "../../../../domain/workspace/calibration";
import type { SimulationRecord, WorkspaceHome } from "../../../../domain/workspace/types";
import { ConfidenceCaveatNote } from "./ConfidenceCaveatNote";

const WS = "11111111-1111-4111-8111-111111111111";

function run(confidence: number, hit: boolean, i: number): SimulationRecord {
  return {
    id: `00000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`,
    workspace_id: WS,
    goal_id: null,
    title: "Launch?",
    status: "completed",
    confidence,
    result: {
      outcome_followed: "yes",
      outcome_verdict: hit ? "as_expected" : "worse",
    },
    created_at: "2026-01-01T00:00:00.000Z",
    version: 1,
    lineage_id: `lineage-${i}`,
    parent_simulation_id: null,
    decision_id: `lineage-${i}`,
  };
}

function home(sims: SimulationRecord[]): WorkspaceHome {
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

function renderNote(h: WorkspaceHome, confidence: number) {
  return render(
    <MemoryRouter>
      <ConfidenceCaveatNote home={h} confidence={confidence} />
    </MemoryRouter>
  );
}

describe("ConfidenceCaveatNote", () => {
  it("renders nothing when the band has too few measured runs", () => {
    const sims = Array.from({ length: CALIBRATION_MIN_SAMPLE - 1 }, (_, i) => run(0.8, true, i));
    renderNote(home(sims), 0.78);
    expect(screen.queryByTestId("confidence-caveat")).not.toBeInTheDocument();
  });

  it("shows the measured rate and a link to full calibration", () => {
    const sims = Array.from({ length: 8 }, (_, i) => run(0.8, i < 6, i));
    renderNote(home(sims), 0.78);
    const el = screen.getByTestId("confidence-caveat");
    expect(el).toHaveTextContent(/70–84%/);
    expect(el).toHaveTextContent(/75%/);
    expect(el).toHaveTextContent(/Self-reported/);
    expect(screen.getByRole("link", { name: /full calibration/i })).toHaveAttribute(
      "href",
      "/workspace/memory"
    );
  });
});
