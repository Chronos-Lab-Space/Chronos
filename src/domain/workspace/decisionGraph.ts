/**
 * Decision graph — the smallest product graph Chronos sells.
 *
 * Shape (MVP):
 *   N0 Open ──► N1a / N1b / N1c (branches)
 *                    └──► N2 Collapsed (chosen path)
 *
 * Inside any single node, agents may loop (plan → tool → observe). That is not
 * the graph. The graph is branch points, compare, commit, and roll back.
 *
 * Not in scope yet: arbitrary DAGs, multi-step paths, merge of two branches.
 */
import type { FutureRecord, SimulationRecord, TimelineNodeRecord } from "./types";

export type DecisionGraphNodeKind = "open" | "branch" | "collapsed";

export type DecisionGraphNode = {
  id: string;
  kind: DecisionGraphNodeKind;
  /** Display title */
  title: string;
  /** Parent node id; null only for open */
  parentId: string | null;
  /** Present on branch nodes */
  futureId?: string;
  score?: number;
  risk?: number;
  confidence?: number;
  summary?: string;
  /** Engine-ranked best among branches */
  recommended?: boolean;
};

export type DecisionGraphEdge = {
  from: string;
  to: string;
  /** explore | commit | rollback */
  kind: "branch" | "collapse" | "rollback";
};

export type DecisionGraph = {
  /** Stable id for this graph snapshot (usually simulation id) */
  id: string;
  objective: string;
  open: DecisionGraphNode;
  branches: DecisionGraphNode[];
  collapsed: DecisionGraphNode | null;
  edges: DecisionGraphEdge[];
  /** Active tip: collapsed if chosen, else open (you stand at the decision point) */
  activeNodeId: string;
  /**
   * Parent simulation this graph was forked from, when it is a re-branch.
   * Provenance lives on the graph so the simulation page can mark a fresh fork
   * immediately — decision history only lists runs that already chose a path.
   */
  rebranchedFromSimulationId: string | null;
};

export const OPEN_NODE_ID = "n0-open";
export const COLLAPSED_NODE_ID = "n2-collapsed";

/**
 * Build the MVP decision graph from a completed simulation + its futures.
 * Futures become peer branches of the open node (parent = open).
 */
export function buildDecisionGraph(
  simulation: SimulationRecord,
  futures: readonly FutureRecord[]
): DecisionGraph {
  const objective = simulation.title || "Decision";
  const open: DecisionGraphNode = {
    id: OPEN_NODE_ID,
    kind: "open",
    title: objective,
    parentId: null,
  };

  const bestName =
    (typeof simulation.result.best_future === "string" && simulation.result.best_future) ||
    futures[0]?.name ||
    null;

  const branches: DecisionGraphNode[] = futures.map((f) => ({
    id: `n1-${f.id}`,
    kind: "branch" as const,
    title: f.name,
    parentId: OPEN_NODE_ID,
    futureId: f.id,
    score: f.score,
    risk: f.risk,
    confidence: f.confidence,
    summary: f.summary,
    recommended: bestName ? f.name === bestName : false,
  }));

  const edges: DecisionGraphEdge[] = branches.map((b) => ({
    from: OPEN_NODE_ID,
    to: b.id,
    kind: "branch" as const,
  }));

  const chosenId =
    typeof simulation.result.chosen_future_id === "string"
      ? simulation.result.chosen_future_id
      : null;
  const chosen = chosenId ? futures.find((f) => f.id === chosenId) : null;

  let collapsed: DecisionGraphNode | null = null;
  if (chosen) {
    collapsed = {
      id: COLLAPSED_NODE_ID,
      kind: "collapsed",
      title: chosen.name,
      parentId: `n1-${chosen.id}`,
      futureId: chosen.id,
      score: chosen.score,
      risk: chosen.risk,
      confidence: chosen.confidence,
      summary: chosen.summary,
    };
    edges.push({
      from: `n1-${chosen.id}`,
      to: COLLAPSED_NODE_ID,
      kind: "collapse",
    });
  }

  const rebranchedFromSimulationId =
    simulation.result.graph_op === "rebranch_from_open" &&
    typeof simulation.result.graph_from_simulation_id === "string"
      ? simulation.result.graph_from_simulation_id
      : null;

  return {
    id: simulation.id,
    objective,
    open,
    branches,
    collapsed,
    edges,
    activeNodeId: collapsed?.id ?? OPEN_NODE_ID,
    rebranchedFromSimulationId,
  };
}

/** Side-by-side comparison rows for branch nodes (product “compare outcomes”). */
export type BranchCompareRow = {
  futureId: string;
  nodeId: string;
  name: string;
  confidence: number;
  risk: number;
  score: number;
  recommended: boolean;
  chosen: boolean;
  summary: string;
  /** score − best score (0 for the recommended branch). */
  scoreDelta: number;
  /** risk − recommended risk (negative = safer than best). */
  riskDelta: number;
  rank: number;
};

export function compareBranches(graph: DecisionGraph): BranchCompareRow[] {
  const chosenFutureId = graph.collapsed?.futureId ?? null;
  const ranked = [...graph.branches].sort(
    (a, b) =>
      (b.score ?? 0) - (a.score ?? 0) || (a.risk ?? 0) - (b.risk ?? 0) || a.id.localeCompare(b.id)
  );
  const bestScore = ranked[0]?.score ?? 0;
  const bestRisk = ranked[0]?.risk ?? 0;

  return ranked.map((b, index) => {
    const score = b.score ?? 0;
    const risk = b.risk ?? 0;
    return {
      futureId: b.futureId ?? b.id,
      nodeId: b.id,
      name: b.title,
      confidence: b.confidence ?? 0,
      risk,
      score,
      recommended: Boolean(b.recommended),
      chosen: chosenFutureId != null && b.futureId === chosenFutureId,
      summary: b.summary ?? "",
      scoreDelta: Math.round((score - bestScore) * 1000) / 1000,
      riskDelta: Math.round((risk - bestRisk) * 1000) / 1000,
      rank: index + 1,
    };
  });
}

/** Compact structure line for Memory / list cards. */
export function summarizeSimulationGraph(
  simulation: SimulationRecord,
  branchCount?: number
): string {
  const n =
    branchCount ??
    (Array.isArray(simulation.result.graph_branch_ids)
      ? simulation.result.graph_branch_ids.length
      : typeof simulation.result.futures_count === "number"
        ? simulation.result.futures_count
        : null);

  const branchLabel = n != null && n > 0 ? `${n} branch${n === 1 ? "" : "es"}` : "branches";

  const collapsedName =
    (typeof simulation.result.chosen_future_name === "string" &&
      simulation.result.chosen_future_name) ||
    (typeof simulation.result.graph_collapsed_future_id === "string" ? "chosen path" : null);

  if (collapsedName) {
    return `Open → ${branchLabel} → collapsed to “${collapsedName}”`;
  }

  const op = simulation.result.graph_op;
  if (op === "rebranch_from_open") {
    return `Open → ${branchLabel} · re-branched (stand at decision point)`;
  }

  return `Open → ${branchLabel} · not yet collapsed`;
}

/** Persistable shape labels stamped on simulation.result. */
export type GraphShapeStamp = "open_branches" | "collapsed";

export function graphShapeForSimulation(simulation: SimulationRecord): GraphShapeStamp {
  if (
    typeof simulation.result.chosen_future_id === "string" ||
    simulation.result.graph_shape === "collapsed"
  ) {
    return "collapsed";
  }
  return "open_branches";
}

/**
 * Rollback = return active tip to the open decision point so you can re-branch.
 * Does not delete existing branch history — those stay as prior children of open.
 */
export function rollbackToOpen(graph: DecisionGraph): DecisionGraph {
  return {
    ...graph,
    activeNodeId: OPEN_NODE_ID,
    // Collapse edge remains in history as a past commit; active tip is open again.
  };
}

export type RebranchIntent = {
  /** Simulation to fork from (same lineage) */
  parentSimulationId: string;
  /** Always re-branch from open — MVP has one decision point */
  fromNodeId: typeof OPEN_NODE_ID;
  graphOp: "rebranch_from_open";
};

/** Intent passed to WorkspaceService to create the next version forked from N0. */
export function rebranchIntent(simulationId: string): RebranchIntent {
  return {
    parentSimulationId: simulationId,
    fromNodeId: OPEN_NODE_ID,
    graphOp: "rebranch_from_open",
  };
}

/**
 * Project timeline_nodes into the decision-graph shape when possible:
 * depth-0 root = open; depth-1 nodes with parent root = branches.
 * Falls back to buildDecisionGraph when timeline is empty/odd.
 */
export function decisionGraphFromTimeline(
  simulation: SimulationRecord,
  futures: readonly FutureRecord[],
  timeline: readonly TimelineNodeRecord[]
): DecisionGraph {
  const base = buildDecisionGraph(simulation, futures);
  if (timeline.length === 0) return base;

  const root = timeline.find((n) => n.parent_id == null) ?? timeline.find((n) => n.depth === 0);
  if (!root) return base;

  // Prefer explicit timeline parentage for branch edges when present
  const children = timeline.filter((n) => n.parent_id === root.id);
  if (children.length === 0) return base;

  return {
    ...base,
    open: {
      ...base.open,
      id: root.id,
      title: root.title.replace(/^Objective:\s*/i, "") || base.open.title,
    },
    // Keep future-backed branches (scores live on futures); timeline only anchors open id.
  };
}

/** Human-readable one-liner for UI / docs. */
export function describeDecisionGraph(graph: DecisionGraph): string {
  const n = graph.branches.length;
  if (graph.collapsed) {
    return `Open → ${n} branch${n === 1 ? "" : "es"} → collapsed to “${graph.collapsed.title}”`;
  }
  if (graph.rebranchedFromSimulationId) {
    return `Open → ${n} branch${n === 1 ? "" : "es"} · re-branched, not yet collapsed (stand at decision point)`;
  }
  return `Open → ${n} branch${n === 1 ? "" : "es"} · not yet collapsed (stand at decision point)`;
}
