import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkspaceHome } from "../../../domain/workspace/types";
import { WorkspaceStart } from "./WorkspaceStart";

const calls: string[] = [];
const runSimulation = vi.fn(async (_objective: string): Promise<string | null> => "sim-1");
const navigate = vi.fn();
// Anonymous visitors already have a seeded workspace by the time this screen
// renders (WorkspaceContext.refresh seeds a sample decision) — tests flip
// this to exercise that branch instead of the brand-new-visitor one.
let home: WorkspaceHome | null = null;

vi.mock("./WorkspaceContext", () => ({
  useWorkspace: () => ({
    home,
    error: null,
    createWorkspace: vi.fn(async () => {
      calls.push("createWorkspace");
    }),
    setGoal: vi.fn(async () => {
      calls.push("setGoal");
    }),
    runSimulation: async (objective: string) => {
      calls.push("runSimulation");
      return runSimulation(objective);
    },
  }),
}));

vi.mock("react-router-dom", () => ({ useNavigate: () => navigate }));

function existingWorkspaceHome(): WorkspaceHome {
  return {
    workspace: {
      id: "ws-1",
      owner_id: "anon-1",
      name: "Chronos Lab",
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

describe("WorkspaceStart", () => {
  // runSimulation/navigate are module-scoped mocks (createWorkspace/setGoal are
  // rebuilt per render inside the WorkspaceContext factory, so they don't need
  // this) — without a reset, call history from one case leaks into the next.
  beforeEach(() => {
    calls.length = 0;
    runSimulation.mockClear();
    runSimulation.mockImplementation(async () => "sim-1");
    navigate.mockClear();
    home = null;
  });

  it("takes a decision and reaches a result in one submit", async () => {
    render(<WorkspaceStart />);

    await userEvent.type(
      screen.getByLabelText(/what are you deciding/i),
      "Launch the beta in September"
    );
    await userEvent.click(screen.getByRole("button", { name: /simulate/i }));

    // Order matters: the workspace has to exist before a goal can hang off it,
    // and the goal before the run that reads it.
    expect(calls).toEqual(["createWorkspace", "setGoal", "runSimulation"]);
    expect(runSimulation).toHaveBeenCalledWith("Launch the beta in September");
    expect(navigate).toHaveBeenCalledWith("/workspace/simulations/sim-1");
  });

  it("does not submit an empty decision", async () => {
    render(<WorkspaceStart />);

    await userEvent.click(screen.getByRole("button", { name: /simulate/i }));

    expect(runSimulation).not.toHaveBeenCalled();
    expect(screen.getByText(/what decision are you working on/i)).toBeInTheDocument();
  });

  it("reuses an existing workspace instead of creating a second one", async () => {
    // createWorkspace never overwrites — calling it here would orphan the
    // workspace the visitor already has and strand their goal and run on a
    // second, empty one.
    home = existingWorkspaceHome();
    render(<WorkspaceStart />);

    await userEvent.type(
      screen.getByLabelText(/what are you deciding/i),
      "Launch the beta in September"
    );
    await userEvent.click(screen.getByRole("button", { name: /simulate/i }));

    expect(calls).toEqual(["setGoal", "runSimulation"]);
    expect(navigate).toHaveBeenCalledWith("/workspace/simulations/sim-1");
  });

  it("surfaces an error instead of stranding the visitor when the run yields no id", async () => {
    runSimulation.mockImplementation(async () => null);
    render(<WorkspaceStart />);

    await userEvent.type(
      screen.getByLabelText(/what are you deciding/i),
      "Launch the beta in September"
    );
    await userEvent.click(screen.getByRole("button", { name: /simulate/i }));

    expect(navigate).not.toHaveBeenCalled();
    expect(screen.getByText(/could not start the simulation/i)).toBeInTheDocument();
  });
});
