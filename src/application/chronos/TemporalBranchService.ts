import {
  Branch,
  Collapse,
  Hypothesis,
  Merge,
  type MergeStrategy,
  type Timeline,
} from "../../domain/chronos/entities";
import type { Action, CollapseStrategy, WorldState } from "../../domain/chronos/types";

/**
 * Branch graph operations are separate from the engine's evaluation loop.
 * This service lets callers explore nested subbranches and converging work
 * while preserving an explicit replayable timeline history.
 */
export class TemporalBranchService {
  private sequence = 0;

  subbranch(parent: Branch, action: Action): Branch {
    const delta = action.apply(parent.state);
    const state = applyDelta(parent.state, delta);
    return parent.subbranch({
      id: this.nextId("subbranch"),
      hypothesis: Hypothesis.fromAction(action),
      state,
    });
  }

  merge(
    timeline: Timeline,
    branches: readonly Branch[],
    strategy: MergeStrategy = "highest-score"
  ): { mergedBranch: Branch; merge: Merge; timeline: Timeline; branches: Branch[] } {
    if (branches.length < 2) throw new Error("At least two branches are required to merge.");
    const target = selectMergeTarget(branches, strategy);
    const merge = new Merge({
      id: this.nextId("merge"),
      timelineId: timeline.id,
      sourceBranchIds: branches.map((branch) => branch.id),
      targetBranchId: target.id,
      strategy,
    });
    const mergedBranch = new Branch({
      id: this.nextId("merged"),
      hypothesis: target.hypothesis,
      state: target.state,
      parentId: target.parentId,
      depth: target.depth,
      mergedFromIds: branches.map((branch) => branch.id),
      outcome: target.outcome,
    });

    return {
      mergedBranch,
      merge,
      timeline: timeline.registerBranches([mergedBranch]).recordMerge(merge),
      branches: [...branches.map((branch) => branch.markMerged()), mergedBranch],
    };
  }

  collapse(
    timeline: Timeline,
    selected: Branch,
    candidates: readonly Branch[],
    strategy: CollapseStrategy
  ): Timeline {
    const collapse = new Collapse({
      id: this.nextId("collapse"),
      timelineId: timeline.id,
      selectedBranchId: selected.id,
      discardedBranchIds: candidates
        .filter((branch) => branch.id !== selected.id)
        .map((branch) => branch.id),
      strategy,
    });
    return timeline.registerBranches(candidates).commit(selected, collapse);
  }

  private nextId(prefix: string): string {
    this.sequence += 1;
    return `${prefix}-${this.sequence.toString(16).padStart(4, "0")}`;
  }
}

function applyDelta(state: WorldState, delta: ReturnType<Action["apply"]>): WorldState {
  return {
    ...state,
    robot: { ...state.robot, ...delta.robot },
    object: { ...state.object, ...delta.object },
    environment: { ...state.environment, ...delta.environment },
    timestamp: state.timestamp + 1,
  };
}

function selectMergeTarget(branches: readonly Branch[], strategy: MergeStrategy): Branch {
  if (strategy === "prefer-target") return branches[0];
  if (strategy === "lowest-risk") {
    return branches.reduce((best, branch) => (branch.risk < best.risk ? branch : best));
  }
  return branches.reduce((best, branch) =>
    (branch.score ?? -1) > (best.score ?? -1) ? branch : best
  );
}
