import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { CALIBRATION_MIN_SAMPLE } from "../../../../domain/workspace/calibration";
import type { SimulationRecord, WorkspaceHome } from "../../../../domain/workspace/types";
import { DecisionCard } from "./DecisionCard";

const WS = "11111111-1111-4111-8111-111111111111";

function run(confidence: number, hit: boolean, i: number): SimulationRecord {
  return {
    id: `00000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`,
    workspace_id: WS,
    goal_id: "g1",
    title: "How should we launch?",
    status: "completed",
    confidence,
    result: {
      outcome_followed: "yes",
      outcome_verdict: hit ? "as_expected" : "worse",
      chosen_future_id: "f1",
      recommendation: "Ship a narrow beta",
    },
    created_at: "2026-01-01T00:00:00.000Z",
    version: 1,
    lineage_id: `lineage-${i}`,
    parent_simulation_id: null,
    decision_id: `lineage-${i}`,
  };
}

function home(sims: SimulationRecord[]): WorkspaceHome {
  const latest = sims.at(-1);
  if (!latest) throw new Error("home() requires at least one simulation");
  return {
    workspace: {
      id: WS,
      owner_id: "u1",
      name: "Lab",
      description: "",
      created_at: "2026-01-01T00:00:00.000Z",
    },
    goal: {
      id: "g1",
      workspace_id: WS,
      title: "How should we launch?",
      description: "",
      status: "active",
      priority: 1,
      created_at: "2026-01-01T00:00:00.000Z",
    },
    goalHistory: [],
    // HQ card reads recentSimulations[0] as latest — put hero run first.
    recentSimulations: [latest, ...sims.slice(0, -1)],
    decisions: [],
    knowledge: [],
    notes: [],
    futuresBySimulation: {
      [latest.id]: [
        {
          id: "f1",
          simulation_id: latest.id,
          name: "Narrow beta",
          score: 0.8,
          risk: 0.2,
          confidence: 0.8,
          summary: "Ship to 50 users",
        },
      ],
    },
    timelineBySimulation: {},
  };
}

describe("DecisionCard confidence caveat", () => {
  it("shows the measured band rate when HQ confidence has enough history", () => {
    const sims = Array.from({ length: 8 }, (_, i) => run(0.8, i < 6, i));
    render(
      <MemoryRouter>
        <DecisionCard home={home(sims)} />
      </MemoryRouter>
    );
    const note = screen.getByTestId("confidence-caveat");
    expect(note).toHaveTextContent(/70–84%/);
    expect(note).toHaveTextContent(/75%/);
  });

  it("omits the caveat when the band is under-sampled", () => {
    const sims = Array.from({ length: CALIBRATION_MIN_SAMPLE - 1 }, (_, i) => run(0.8, true, i));
    render(
      <MemoryRouter>
        <DecisionCard home={home(sims)} />
      </MemoryRouter>
    );
    expect(screen.queryByTestId("confidence-caveat")).not.toBeInTheDocument();
  });
});
