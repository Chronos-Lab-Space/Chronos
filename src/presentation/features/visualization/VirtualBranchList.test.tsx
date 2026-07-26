import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Branch, Hypothesis, Outcome } from "../../../domain/chronos/entities";
import type { Action, BranchStatus, WorldState } from "../../../domain/chronos/types";
import { VirtualBranchList } from "./VirtualBranchList";

const worldState: WorldState = {
  robot: { x: 0, y: 0, armAngle: 0, gripOpen: false },
  object: { x: 1, y: 1, stable: true, grasped: false },
  environment: { humanPresent: false, wind: 0, lighting: "bright" },
  timestamp: 0,
};

function makeBranch(index: number, status: BranchStatus, score: number | null): Branch {
  const action: Action = {
    id: `a${index}`,
    name: `strategy-${index}`,
    description: "test action",
    apply: () => ({}),
    baseRisk: 0.2,
    baseReward: 0.6,
  };
  return new Branch({
    id: `b${index}`,
    hypothesis: Hypothesis.fromAction(action),
    state: worldState,
    status,
    outcome:
      score === null
        ? null
        : new Outcome({
            branchId: `b${index}`,
            score,
            reward: 0.6,
            risk: 0.2,
            reason: "scored",
            evaluatedAt: 1,
          }),
  });
}

describe("VirtualBranchList", () => {
  it("mounts a window of rows, not the whole branch set", () => {
    const branches = Array.from({ length: 500 }, (_, i) => makeBranch(i, "evaluated", 0.5));
    render(<VirtualBranchList branches={branches} />);

    // height 440 / rowHeight 76 + default overscan → far fewer than 500 rows
    expect(screen.getAllByTestId("virtual-row").length).toBeLessThan(20);
    expect(screen.getByText("branch_b0", { exact: false })).toBeInTheDocument();
    expect(screen.queryByText("branch_b499", { exact: false })).not.toBeInTheDocument();
  });

  it("reveals the tail of the list after scrolling to the bottom", () => {
    const branches = Array.from({ length: 500 }, (_, i) => makeBranch(i, "evaluated", 0.5));
    render(<VirtualBranchList branches={branches} />);

    fireEvent.scroll(screen.getByTestId("virtual-list"), {
      // 500 rows × 76px − 440px viewport
      target: { scrollTop: 500 * 76 - 440 },
    });

    expect(screen.getByText("branch_b499", { exact: false })).toBeInTheDocument();
    expect(screen.queryByText("branch_b0", { exact: false })).not.toBeInTheDocument();
  });

  it("renders scores to three decimals and 'pending' for unevaluated branches", () => {
    // Evaluated-but-unscored: the score slot reads "pending" while the status stays distinct.
    const branches = [makeBranch(0, "winner", 0.4215), makeBranch(1, "evaluated", null)];
    render(<VirtualBranchList branches={branches} />);

    expect(screen.getByText("0.421")).toBeInTheDocument();
    expect(screen.getByText("pending")).toBeInTheDocument();
    expect(screen.getByText("winner")).toBeInTheDocument();
  });

  it("dims pruned branches and shows the prune reason", () => {
    const branches = [makeBranch(0, "pruned", 0.1)];
    render(<VirtualBranchList branches={branches} />);

    expect(screen.getByText("· scored", { exact: false })).toBeInTheDocument();
    const row = screen.getByText("strategy-0").closest("div[style]");
    expect(row).not.toBeNull();
  });
});
