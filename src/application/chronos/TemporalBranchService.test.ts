import { describe, expect, it } from "vitest";
import { collapse, createEngine, evaluate, fork } from "./engine";
import { TemporalBranchService } from "./TemporalBranchService";
import { getScenario } from "../../domain/chronos/scenarios";

describe("TemporalBranchService", () => {
  it("creates subbranches with parent lineage and independent state", () => {
    const scenario = getScenario("robot-arm");
    const root = fork(createEngine(scenario.id, scenario.initialState, scenario.actions))
      .branches[0];
    const service = new TemporalBranchService();
    const subbranch = service.subbranch(root, scenario.actions[1]);

    expect(subbranch.parentId).toBe(root.id);
    expect(subbranch.depth).toBe(root.depth + 1);
    expect(subbranch.state).not.toBe(root.state);
    expect(subbranch.actionId).toBe("approach-cautious");
  });

  it("records merges without collapsing the timeline", () => {
    const scenario = getScenario("robot-arm");
    const evaluated = evaluate(
      fork(createEngine(scenario.id, scenario.initialState, scenario.actions))
    );
    const service = new TemporalBranchService();
    const result = service.merge(evaluated.timeline, evaluated.branches.slice(0, 2));

    expect(result.merge.sourceBranchIds).toEqual([
      evaluated.branches[0].id,
      evaluated.branches[1].id,
    ]);
    expect(result.mergedBranch.isMerged).toBe(true);
    expect(result.timeline.merges).toHaveLength(1);
    expect(result.timeline.committedBranchId).toBeUndefined();
    expect(result.branches.filter((branch) => branch.status === "merged")).toHaveLength(2);
  });

  it("records discarded branches when collapsing a timeline", () => {
    const scenario = getScenario("robot-arm");
    const completed = collapse(
      evaluate(fork(createEngine(scenario.id, scenario.initialState, scenario.actions)))
    );
    const winner = completed.winner!;
    const latest = completed.timeline.collapses[completed.timeline.collapses.length - 1];

    expect(latest.selectedBranchId).toBe(winner.id);
    expect(latest.discardedBranchIds).toHaveLength(3);
    expect(latest.strategy).toBe("max-utility");
  });
});
