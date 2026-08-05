import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import type { GoalRecord, SimulationRecord, WorkspaceHome } from "../../../domain/workspace/types";
import { WorkspaceContextRail } from "./WorkspaceContextRail";

function goal(title: string, description = ""): GoalRecord {
  return {
    id: "g1",
    workspace_id: "w1",
    title,
    description,
    status: "active",
    priority: 1,
    created_at: "2026-07-01T00:00:00.000Z",
  };
}

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

const closed = sim({
  id: "sim-closed",
  title: "Docs relaunch",
  confidence: 0.74,
  created_at: "2026-05-20T00:00:00.000Z",
  result: {
    chosen_future_name: "Big bang release",
    chosen_at: "2026-05-22T00:00:00.000Z",
    outcome_verdict: "worse",
    outcome_result: "Support load tripled our estimate.",
  },
});

function home(
  goalRecord: GoalRecord | null = null,
  sims: SimulationRecord[] = [latest, older]
): WorkspaceHome {
  return {
    workspace: { id: "w1", owner_id: "u1", name: "Lab", description: "", created_at: "" },
    goal: goalRecord,
    goalHistory: [],
    knowledge: [],
    notes: [],
    // newest first, as the product stores them
    recentSimulations: sims,
    futuresBySimulation: {},
    timelineBySimulation: {},
  } as unknown as WorkspaceHome;
}

function renderRail(
  activeSimulationId?: string,
  goalRecord: GoalRecord | null = null,
  sims?: SimulationRecord[]
) {
  return render(
    <MemoryRouter>
      <WorkspaceContextRail home={home(goalRecord, sims)} activeSimulationId={activeSimulationId} />
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

  it("lists the measurable targets named in the objective", () => {
    renderRail(undefined, goal("Launch the beta", "Reach 1,000 signups at 40% retention"));

    const targets = screen.getByTestId("rail-targets");
    expect(within(targets).getByText("signups")).toBeInTheDocument();
    expect(within(targets).getByText("1,000")).toBeInTheDocument();
    expect(within(targets).getByText("retention")).toBeInTheDocument();
    expect(within(targets).getByText("40%")).toBeInTheDocument();
  });

  it("asks for a number when the objective names no target", () => {
    renderRail(undefined, goal("Launch a beta that earns durable adoption"));

    expect(screen.getByTestId("rail-targets")).toHaveTextContent(/no measurable target/i);
  });

  it("omits targets entirely when no objective is set", () => {
    renderRail();

    expect(screen.queryByTestId("rail-targets")).not.toBeInTheDocument();
  });

  it("puts priors in play with what they predicted and how they landed", () => {
    renderRail(undefined, null, [latest, closed]);

    const memory = screen.getByTestId("rail-memory");
    expect(within(memory).getByText(/big bang release/i)).toBeInTheDocument();
    expect(within(memory).getByText(/74%/)).toBeInTheDocument();
    expect(within(memory).getByText(/worse than predicted/i)).toBeInTheDocument();
  });

  it("says memory is empty until an outcome has actually been logged", () => {
    renderRail();

    expect(screen.getByTestId("rail-memory")).toHaveTextContent(/no outcome logged yet/i);
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
