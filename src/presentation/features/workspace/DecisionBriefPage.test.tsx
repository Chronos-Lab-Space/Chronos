import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import type {
  FutureRecord,
  SimulationRecord,
  WorkspaceHome,
} from "../../../domain/workspace/types";
import { DecisionBriefPage } from "./DecisionBriefPage";

const home = vi.hoisted(() => ({ current: null as WorkspaceHome | null }));

vi.mock("./WorkspaceContext", () => ({
  useWorkspace: () => ({ home: home.current }),
}));

function future(over: Partial<FutureRecord> & Pick<FutureRecord, "id" | "name" | "score">) {
  return {
    simulation_id: "s1",
    risk: 0.3,
    confidence: over.score,
    summary: `${over.name} summary`,
    ...over,
  } as FutureRecord;
}

function workspaceHome(futures: FutureRecord[]): WorkspaceHome {
  const simulation: SimulationRecord = {
    id: "s1",
    workspace_id: "w1",
    goal_id: "g1",
    title: "How should we launch?",
    status: "completed",
    confidence: 0.72,
    result: { best_future: "Community first", recommendation: "Community list first." },
    created_at: "2026-07-24T00:00:00.000Z",
    version: 1,
    lineage_id: "s1",
    parent_simulation_id: null,
  };
  return {
    workspace: { id: "w1", owner_id: "u1", name: "Lab", description: "", created_at: "" },
    goal: {
      id: "g1",
      workspace_id: "w1",
      title: "Launch the public beta",
      description: "Reach 1,000 signups",
      status: "active",
      priority: 1,
      created_at: "2026-07-18T00:00:00.000Z",
    },
    goalHistory: [],
    decisions: [],
    recentSimulations: [simulation],
    knowledge: [],
    notes: [],
    futuresBySimulation: { s1: futures },
    timelineBySimulation: {},
  } as unknown as WorkspaceHome;
}

function renderBrief(futures: FutureRecord[]) {
  home.current = workspaceHome(futures);
  return render(
    <MemoryRouter>
      <DecisionBriefPage />
    </MemoryRouter>
  );
}

describe("DecisionBriefPage ranked futures", () => {
  it("says how far behind the leader a beaten future is", () => {
    renderBrief([
      future({ id: "f1", name: "Community first", score: 0.72 }),
      future({ id: "f2", name: "Big bang launch", score: 0.61 }),
    ]);

    const row = screen.getByTestId("future-f2");
    expect(within(row).getByText(/11 pts behind/i)).toBeInTheDocument();
  });

  it("names a constraint breach instead of showing a bare zero", () => {
    renderBrief([
      future({ id: "f1", name: "Community first", score: 0.72 }),
      future({ id: "f3", name: "Raise a round first", score: 0 }),
    ]);

    const row = screen.getByTestId("future-f3");
    expect(within(row).getByText(/breaches a constraint/i)).toBeInTheDocument();
    expect(within(row).queryByText(/pts behind/i)).not.toBeInTheDocument();
  });

  it("labels the recommendation rather than ranking it against itself", () => {
    renderBrief([
      future({ id: "f1", name: "Community first", score: 0.72 }),
      future({ id: "f2", name: "Big bang launch", score: 0.61 }),
    ]);

    const row = screen.getByTestId("future-f1");
    expect(within(row).getByText(/recommended/i)).toBeInTheDocument();
    expect(within(row).queryByText(/pts behind/i)).not.toBeInTheDocument();
  });
});
