import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { WorkspaceStart } from "./WorkspaceStart";

const calls: string[] = [];
const runSimulation = vi.fn(async (_objective: string) => "sim-1");
const navigate = vi.fn();

vi.mock("./WorkspaceContext", () => ({
  useWorkspace: () => ({
    home: null,
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

describe("WorkspaceStart", () => {
  // runSimulation/navigate are module-scoped mocks (createWorkspace/setGoal are
  // rebuilt per render inside the WorkspaceContext factory, so they don't need
  // this) — without a reset, call history from one case leaks into the next.
  beforeEach(() => {
    calls.length = 0;
    runSimulation.mockClear();
    navigate.mockClear();
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
});
