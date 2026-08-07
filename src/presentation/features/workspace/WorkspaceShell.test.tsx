import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import type { SimulationRecord, WorkspaceHome } from "../../../domain/workspace/types";
import { WorkspaceShell } from "./WorkspaceShell";

const state = vi.hoisted(() => ({ home: null as WorkspaceHome | null }));

vi.mock("./WorkspaceContext", () => ({
  WorkspaceProvider: ({ children }: { children: React.ReactNode }) => children,
  useWorkspace: () => ({
    home: state.home,
    loading: false,
    ownerId: "user-1",
    error: null,
    remoteError: null,
    notice: null,
    dismissNotice: vi.fn(),
    entrySubmitting: false,
  }),
}));

// The rail and palette have their own tests; the shell only places them.
vi.mock("./WorkspaceContextRail", () => ({ WorkspaceContextRail: () => null }));
vi.mock("./WorkspaceCommandPalette", () => ({ WorkspaceCommandPalette: () => null }));
vi.mock("./WorkspaceStart", () => ({ WorkspaceStart: () => null }));
vi.mock("../../../infrastructure/auth/SupabaseAuthService", () => ({
  authService: { signOut: vi.fn() },
}));

function workspaceHome(sims: SimulationRecord[]): WorkspaceHome {
  return {
    workspace: { id: "w1", owner_id: "user-1", name: "Lab", description: "", created_at: "" },
    goal: {
      id: "g1",
      workspace_id: "w1",
      title: "Launch the public beta",
      description: "",
      status: "active",
      priority: 1,
      created_at: "2026-07-18T00:00:00.000Z",
    },
    goalHistory: [],
    decisions: [],
    recentSimulations: sims,
    knowledge: [],
    notes: [],
    futuresBySimulation: {},
    timelineBySimulation: {},
  } as unknown as WorkspaceHome;
}

function sim(over: Partial<SimulationRecord> & Pick<SimulationRecord, "id">): SimulationRecord {
  return {
    workspace_id: "w1",
    goal_id: "g1",
    title: "How should we launch?",
    status: "completed",
    confidence: 0.72,
    result: {},
    created_at: "2026-07-24T00:00:00.000Z",
    version: 1,
    lineage_id: over.id,
    parent_simulation_id: null,
    ...over,
  };
}

function renderShell(sims: SimulationRecord[]) {
  state.home = workspaceHome(sims);
  return render(
    <MemoryRouter initialEntries={["/workspace"]}>
      <WorkspaceShell />
    </MemoryRouter>
  );
}

describe("WorkspaceShell active-decision card", () => {
  it("carries the confidence of the latest completed run", () => {
    renderShell([sim({ id: "s1", confidence: 0.72 })]);

    const card = screen.getByTestId("sidebar-active-decision");
    expect(within(card).getByText(/72%/)).toBeInTheDocument();
  });

  it("shows no confidence before a run has completed", () => {
    renderShell([sim({ id: "s1", status: "running", confidence: null })]);

    const card = screen.getByTestId("sidebar-active-decision");
    expect(within(card).queryByText(/%/)).not.toBeInTheDocument();
  });

  it("shows the pipeline stage label, not the raw simulation status", () => {
    renderShell([sim({ id: "s1", status: "completed", confidence: 0.72 })]);

    const card = screen.getByTestId("sidebar-active-decision");
    // A completed, unchosen run sits at "Evaluating" in the six-stage pipeline —
    // the same vocabulary StepperBand and the Decision Brief already use, not
    // the raw SimulationRecord.status ("completed").
    expect(within(card).getByText("Evaluating")).toBeInTheDocument();
    expect(within(card).queryByText("completed")).not.toBeInTheDocument();
  });
});
