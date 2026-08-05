import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import type { SimulationRecord, WorkspaceHome } from "../../../domain/workspace/types";

// Only the workspace hook matters here — the page under test reads `home`.
const useWorkspace = vi.fn();
vi.mock("../workspace/WorkspaceContext", () => ({
  useWorkspace: () => useWorkspace(),
}));

import { MemoryPage } from "./MemoryPages";

function renderPage() {
  return render(
    <MemoryRouter>
      <MemoryPage />
    </MemoryRouter>
  );
}

describe("MemoryPage during hydration", () => {
  it("still renders the page identity while the workspace is null", () => {
    // `home` is null before the first load resolves. Returning null for that
    // rendered a blank page — the page appeared not to exist on a slow load,
    // and anything navigating straight here raced the hydrate.
    useWorkspace.mockReturnValue({ home: null });

    renderPage();

    expect(screen.getByRole("heading", { name: /history/i })).toBeInTheDocument();
    expect(screen.getByTestId("surface-loading")).toBeInTheDocument();
  });

  it("drops the loading line once the workspace arrives", () => {
    useWorkspace.mockReturnValue({
      home: {
        workspace: { id: "w1", name: "Lab" },
        recentSimulations: [],
        goalHistory: [],
        knowledge: [],
        notes: [],
        futuresBySimulation: {},
        timelineBySimulation: {},
      },
    });

    renderPage();

    expect(screen.getByRole("heading", { name: /history/i })).toBeInTheDocument();
    expect(screen.queryByTestId("surface-loading")).not.toBeInTheDocument();
  });
});

function sim(over: Partial<SimulationRecord> & Pick<SimulationRecord, "id">): SimulationRecord {
  return {
    workspace_id: "w1",
    goal_id: null,
    title: "Docs relaunch",
    status: "completed",
    confidence: 0.74,
    result: {},
    created_at: "2026-05-20T00:00:00.000Z",
    version: 1,
    lineage_id: over.id,
    parent_simulation_id: null,
    ...over,
  };
}

function renderHistory(sims: SimulationRecord[]) {
  useWorkspace.mockReturnValue({
    home: {
      workspace: { id: "w1", name: "Lab" },
      goal: null,
      goalHistory: [],
      decisions: [],
      recentSimulations: sims,
      knowledge: [],
      notes: [],
      futuresBySimulation: {},
      timelineBySimulation: {},
    } as unknown as WorkspaceHome,
  });
  return renderPage();
}

describe("MemoryPage decision history", () => {
  it("reads each prediction against how it actually landed", () => {
    renderHistory([
      sim({
        id: "s1",
        confidence: 0.74,
        result: {
          chosen_future_name: "Big bang release",
          chosen_at: "2026-05-22T00:00:00.000Z",
          outcome_verdict: "worse",
          outcome_result: "Support load tripled our estimate.",
        },
      }),
    ]);

    const row = screen.getByTestId("memory-decision-s1");
    expect(within(row).getByText(/predicted 74%/i)).toBeInTheDocument();
    expect(within(row).getByText(/worse than predicted/i)).toBeInTheDocument();
  });

  it("claims no comparison before the outcome is logged", () => {
    renderHistory([
      sim({
        id: "s2",
        result: { chosen_future_name: "Staged rollout", chosen_at: "2026-06-01T00:00:00.000Z" },
      }),
    ]);

    const row = screen.getByTestId("memory-decision-s2");
    expect(within(row).queryByText(/than predicted/i)).not.toBeInTheDocument();
    expect(within(row).getByText(/outcome pending/i)).toBeInTheDocument();
  });
});
