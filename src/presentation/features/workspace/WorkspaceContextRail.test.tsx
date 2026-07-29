import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import type { SimulationRecord, WorkspaceHome } from "../../../domain/workspace/types";
import { WorkspaceContextRail } from "./WorkspaceContextRail";

function sim(over: Partial<SimulationRecord> = {}): SimulationRecord {
  return {
    id: "sim-latest",
    workspace_id: "w1",
    goal_id: null,
    title: "Latest run",
    status: "completed",
    confidence: 0.8,
    result: {},
    created_at: "2026-07-20T00:00:00.000Z",
    version: 1,
    lineage_id: "L1",
    parent_simulation_id: null,
    ...over,
  };
}

const older = sim({
  id: "sim-older",
  title: "Older run",
  created_at: "2026-07-10T00:00:00.000Z",
  result: { constraints: ["keep 12 months runway"] },
});

const latest = sim({
  id: "sim-latest",
  result: { constraints: ["no raise before launch"] },
});

function home(): WorkspaceHome {
  return {
    workspace: { id: "w1", owner_id: "u1", name: "Lab", description: "", created_at: "" },
    goal: null,
    goalHistory: [],
    knowledge: [],
    notes: [],
    // newest first, as the product stores them
    recentSimulations: [latest, older],
    futuresBySimulation: {},
    timelineBySimulation: {},
  } as unknown as WorkspaceHome;
}

function renderRail(activeSimulationId?: string) {
  return render(
    <MemoryRouter>
      <WorkspaceContextRail home={home()} activeSimulationId={activeSimulationId} />
    </MemoryRouter>
  );
}

describe("WorkspaceContextRail", () => {
  it("shows the active simulation's constraints, not the newest run's", () => {
    // Viewing an older run must not describe a different simulation. Showing
    // the wrong context is worse than showing none.
    renderRail("sim-older");

    expect(screen.getByText(/keep 12 months runway/i)).toBeInTheDocument();
    expect(screen.queryByText(/no raise before launch/i)).not.toBeInTheDocument();
  });

  it("points Log outcome at the simulation being viewed", () => {
    renderRail("sim-older");

    expect(screen.getByRole("link", { name: /log outcome/i })).toHaveAttribute(
      "href",
      "/workspace/simulations/sim-older"
    );
  });

  it("excludes the active simulation from related runs", () => {
    renderRail("sim-older");

    const related = screen.getByTestId("rail-related");
    expect(within(related).queryByText(/older run/i)).not.toBeInTheDocument();
    expect(within(related).getByText(/latest run/i)).toBeInTheDocument();
  });

  it("falls back to the newest run when no simulation is active", () => {
    // Dashboard routes have no simulation in view — prior behaviour stands.
    renderRail();

    expect(screen.getByText(/no raise before launch/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /log outcome/i })).toHaveAttribute(
      "href",
      "/workspace/simulations/sim-latest"
    );
  });
});
