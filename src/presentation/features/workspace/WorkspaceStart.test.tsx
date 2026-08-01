import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect, useReducer } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { showsEntrySurface } from "../../../domain/workspace/onboarding";
import type { WorkspaceHome } from "../../../domain/workspace/types";
import { WorkspaceStart } from "./WorkspaceStart";

const runSimulation = vi.fn(async (_objective: string): Promise<string | null> => "sim-1");
const navigate = vi.fn();

/**
 * A live stand-in for the workspace, not a frozen snapshot. `setGoal` really
 * does change what `isWorkspaceOnboarded` answers, mid-submit, and a mock
 * that never moves would let this screen's loading and error states pass
 * while being unreachable in the product.
 */
const store = vi.hoisted(() => {
  const listeners = new Set<() => void>();
  const state = {
    listeners,
    home: null as WorkspaceHome | null,
    entrySubmitting: false,
    error: null as string | null,
    calls: [] as string[],
    patch(next: Partial<{ home: WorkspaceHome | null; entrySubmitting: boolean; error: string }>) {
      Object.assign(state, next);
      for (const listener of [...listeners]) listener();
    },
  };
  return state;
});

/** Re-render everything reading the store when it moves. */
function useStoreSubscription() {
  const [, bump] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    store.listeners.add(bump);
    return () => {
      store.listeners.delete(bump);
    };
  }, []);
}

function workspaceOnly(): WorkspaceHome {
  return {
    workspace: {
      id: "ws-1",
      owner_id: "anon-1",
      name: "My workspace",
      description: "",
      created_at: "2026-01-01T00:00:00.000Z",
    },
    goal: null,
    goalHistory: [],
    decisions: [],
    recentSimulations: [],
    knowledge: [],
    notes: [],
    futuresBySimulation: {},
    timelineBySimulation: {},
  };
}

function withGoal(home: WorkspaceHome | null, title: string): WorkspaceHome {
  const base = home ?? workspaceOnly();
  return {
    ...base,
    goal: {
      id: "goal-1",
      workspace_id: base.workspace.id,
      title,
      description: "",
      status: "active",
      priority: 1,
      created_at: "2026-01-01T00:00:00.000Z",
    },
  };
}

vi.mock("./WorkspaceContext", () => ({
  useWorkspace: () => {
    useStoreSubscription();
    return {
      home: store.home,
      error: store.error,
      entrySubmitting: store.entrySubmitting,
      setEntrySubmitting: (value: boolean) => store.patch({ entrySubmitting: value }),
      reportError: (message: string) => store.patch({ error: message }),
      createWorkspace: async () => {
        store.calls.push("createWorkspace");
        store.patch({ home: workspaceOnly() });
      },
      setGoal: async (title: string) => {
        store.calls.push("setGoal");
        store.patch({ home: withGoal(store.home, title) });
      },
      runSimulation: async (objective: string) => {
        store.calls.push("runSimulation");
        return runSimulation(objective);
      },
    };
  },
}));

vi.mock("react-router-dom", () => ({ useNavigate: () => navigate }));

/**
 * What the shell does around this screen: the same predicate decides whether
 * the entry surface or the workspace is on screen, and the workspace index
 * greets a visitor with no result yet by offering to run one — the invitation
 * that used to appear while their run was still going.
 */
function Shell() {
  useStoreSubscription();
  return (
    <>
      {store.error ? <p>{store.error}</p> : null}
      {showsEntrySurface(store.home, store.entrySubmitting) ? (
        <WorkspaceStart />
      ) : (
        <p>No recommendation available. Run your first simulation to generate ranked futures.</p>
      )}
    </>
  );
}

const decisionField = () => screen.getByLabelText(/what are you deciding/i);
const simulateButton = () => screen.getByRole("button", { name: /simulat/i });

describe("WorkspaceStart", () => {
  beforeEach(() => {
    store.calls.length = 0;
    store.home = null;
    store.entrySubmitting = false;
    store.error = null;
    runSimulation.mockClear();
    runSimulation.mockImplementation(async () => "sim-1");
    navigate.mockClear();
  });

  it("takes a decision and reaches a result in one submit", async () => {
    render(<Shell />);

    await userEvent.type(decisionField(), "Launch the beta in September");
    await userEvent.click(simulateButton());

    // Order matters: the workspace has to exist before a goal can hang off it,
    // and the goal before the run that reads it.
    expect(store.calls).toEqual(["createWorkspace", "setGoal", "runSimulation"]);
    expect(runSimulation).toHaveBeenCalledWith("Launch the beta in September");
    expect(navigate).toHaveBeenCalledWith("/workspace/simulations/sim-1");
  });

  it("does not submit an empty decision", async () => {
    render(<Shell />);

    await userEvent.click(simulateButton());

    expect(runSimulation).not.toHaveBeenCalled();
    expect(screen.getByText(/what decision are you working on/i)).toBeInTheDocument();
  });

  it("reuses an existing workspace instead of creating a second one", async () => {
    // createWorkspace never overwrites — calling it here would orphan the
    // workspace the visitor already has and strand their goal and run on a
    // second, empty one.
    store.home = workspaceOnly();
    render(<Shell />);

    await userEvent.type(decisionField(), "Launch the beta in September");
    await userEvent.click(simulateButton());

    expect(store.calls).toEqual(["setGoal", "runSimulation"]);
    expect(navigate).toHaveBeenCalledWith("/workspace/simulations/sim-1");
  });

  it("refuses an objective the catalog cannot model", async () => {
    render(<Shell />);

    await userEvent.type(decisionField(), "I want to cook boiled egg");

    // Live on the field, not on a rejected submit: the same guard, and the
    // same moment, as the older run form. Without it this screen ranked
    // go-to-market scenarios against boiling an egg and printed a confidence.
    expect(screen.getByText(/startup and business decisions/i)).toBeInTheDocument();
    await userEvent.click(simulateButton());

    expect(store.calls).toEqual([]);
    expect(runSimulation).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });

  it("runs a business objective the catalog does model", async () => {
    render(<Shell />);

    await userEvent.type(decisionField(), "Raise a seed round or bootstrap");

    // The gate must not become a wall.
    expect(screen.queryByText(/startup and business decisions/i)).not.toBeInTheDocument();
    await userEvent.click(simulateButton());

    expect(runSimulation).toHaveBeenCalledWith("Raise a seed round or bootstrap");
  });

  it("holds the screen while the run is in flight instead of offering another one", async () => {
    let finishRun: ((id: string | null) => void) | null = null;
    runSimulation.mockImplementation(
      () =>
        new Promise<string | null>((resolve) => {
          finishRun = resolve;
        })
    );
    render(<Shell />);

    await userEvent.type(decisionField(), "Launch the beta in September");
    await userEvent.click(simulateButton());

    // The goal is saved by now, so the workspace is technically "onboarded" —
    // but the run it belongs to has not finished. Taking the index's CTA here
    // started a second run for the same decision.
    expect(screen.queryByText(/run your first simulation/i)).not.toBeInTheDocument();
    expect(decisionField()).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /simulating/i })).toBeDisabled();

    await act(async () => finishRun?.("sim-1"));

    expect(navigate).toHaveBeenCalledWith("/workspace/simulations/sim-1");
  });

  it("leaves an error the visitor can still read when the run yields no id", async () => {
    runSimulation.mockImplementation(async () => null);
    render(<Shell />);

    await userEvent.type(decisionField(), "Launch the beta in September");
    await userEvent.click(simulateButton());

    // The screen that hit the failure is gone by now — the goal is saved, so
    // the shell has moved on. The message has to outlive it.
    expect(navigate).not.toHaveBeenCalled();
    expect(screen.getByText(/could not start the simulation/i)).toBeInTheDocument();
  });

  it("keeps a thrown failure readable after the screen gives way", async () => {
    runSimulation.mockImplementation(async () => {
      throw new Error("Simulation engine unavailable");
    });
    render(<Shell />);

    await userEvent.type(decisionField(), "Launch the beta in September");
    await userEvent.click(simulateButton());

    expect(navigate).not.toHaveBeenCalled();
    expect(screen.getByText(/simulation engine unavailable/i)).toBeInTheDocument();
  });
});
