import { describe, expect, it } from "vitest";
import {
  buildDecisionGraph,
  compareBranches,
  describeDecisionGraph,
  graphShapeForSimulation,
  OPEN_NODE_ID,
  rebranchIntent,
  rollbackToOpen,
  summarizeSimulationGraph,
} from "./decisionGraph";
import type { FutureRecord, SimulationRecord } from "./types";

const futures: FutureRecord[] = [
  {
    id: "f-a",
    simulation_id: "s1",
    name: "Invite-only",
    score: 0.9,
    risk: 0.2,
    confidence: 0.88,
    summary: "Ship gated beta",
  },
  {
    id: "f-b",
    simulation_id: "s1",
    name: "Self-serve",
    score: 0.7,
    risk: 0.55,
    confidence: 0.6,
    summary: "Open signup",
  },
  {
    id: "f-c",
    simulation_id: "s1",
    name: "Wait",
    score: 0.55,
    risk: 0.15,
    confidence: 0.7,
    summary: "Harden first",
  },
];

function sim(over: Partial<SimulationRecord> = {}): SimulationRecord {
  return {
    id: "s1",
    workspace_id: "w1",
    goal_id: "g1",
    title: "How do we launch public beta?",
    status: "completed",
    confidence: 0.88,
    result: { best_future: "Invite-only" },
    created_at: "2026-07-21T00:00:00.000Z",
    version: 1,
    lineage_id: "L1",
    parent_simulation_id: null,
    ...over,
  };
}

describe("decisionGraph MVP", () => {
  it("builds open + peer branches (not a chain)", () => {
    const g = buildDecisionGraph(sim(), futures);
    expect(g.open.id).toBe(OPEN_NODE_ID);
    expect(g.open.parentId).toBeNull();
    expect(g.branches).toHaveLength(3);
    expect(g.branches.every((b) => b.parentId === OPEN_NODE_ID)).toBe(true);
    expect(g.collapsed).toBeNull();
    expect(g.activeNodeId).toBe(OPEN_NODE_ID);
    expect(g.edges.filter((e) => e.kind === "branch")).toHaveLength(3);
  });

  it("collapses to N2 when a path is chosen", () => {
    const g = buildDecisionGraph(
      sim({
        result: {
          best_future: "Invite-only",
          chosen_future_id: "f-a",
          chosen_future_name: "Invite-only",
        },
      }),
      futures
    );
    expect(g.collapsed?.title).toBe("Invite-only");
    expect(g.collapsed?.parentId).toBe("n1-f-a");
    expect(g.activeNodeId).toBe(g.collapsed!.id);
    expect(g.edges.some((e) => e.kind === "collapse")).toBe(true);
  });

  it("compareBranches ranks by score and flags recommended/chosen", () => {
    const g = buildDecisionGraph(
      sim({
        result: {
          best_future: "Invite-only",
          chosen_future_id: "f-b",
          chosen_future_name: "Self-serve",
        },
      }),
      futures
    );
    const rows = compareBranches(g);
    expect(rows[0]!.name).toBe("Invite-only");
    expect(rows[0]!.recommended).toBe(true);
    expect(rows.find((r) => r.name === "Self-serve")?.chosen).toBe(true);
  });

  it("rollback returns active tip to open without dropping branches", () => {
    const g = buildDecisionGraph(
      sim({
        result: {
          best_future: "Invite-only",
          chosen_future_id: "f-a",
          chosen_future_name: "Invite-only",
        },
      }),
      futures
    );
    const rolled = rollbackToOpen(g);
    expect(rolled.branches).toHaveLength(3);
    expect(rolled.collapsed).not.toBeNull(); // history kept
    expect(rolled.activeNodeId).toBe(OPEN_NODE_ID);
  });

  it("rebranchIntent always targets open", () => {
    const intent = rebranchIntent("s1");
    expect(intent.fromNodeId).toBe(OPEN_NODE_ID);
    expect(intent.graphOp).toBe("rebranch_from_open");
    expect(intent.parentSimulationId).toBe("s1");
  });

  it("describes graph state", () => {
    const open = buildDecisionGraph(sim(), futures);
    expect(describeDecisionGraph(open)).toMatch(/3 branches/);
    expect(describeDecisionGraph(open)).toMatch(/not yet collapsed/);
  });

  it("carries re-branch provenance into the graph, not just the memory summary", () => {
    // A fork is stamped graph_op on the *new* simulation. The panel renders from
    // DecisionGraph, so provenance has to survive buildDecisionGraph or the
    // sim page you land on after forking cannot tell you it is a fork.
    const fork = sim({
      id: "s2",
      version: 2,
      parent_simulation_id: "s1",
      result: {
        best_future: "Invite-only",
        graph_op: "rebranch_from_open",
        graph_from_simulation_id: "s1",
      },
    });
    const g = buildDecisionGraph(fork, futures);
    expect(g.rebranchedFromSimulationId).toBe("s1");
    expect(describeDecisionGraph(g)).toMatch(/re-branched/i);
  });

  it("leaves a first-run graph unmarked", () => {
    const g = buildDecisionGraph(sim(), futures);
    expect(g.rebranchedFromSimulationId).toBeNull();
    expect(describeDecisionGraph(g)).not.toMatch(/re-branched/i);
  });

  it("compareBranches includes rank and deltas vs best", () => {
    const g = buildDecisionGraph(sim(), futures);
    const rows = compareBranches(g);
    expect(rows[0]!.rank).toBe(1);
    expect(rows[0]!.scoreDelta).toBe(0);
    expect(rows[1]!.scoreDelta).toBeLessThan(0);
    expect(rows[1]!.riskDelta).not.toBeUndefined();
  });

  it("summarizeSimulationGraph reflects collapse and re-branch stamps", () => {
    expect(summarizeSimulationGraph(sim({ result: { futures_count: 3 } }))).toMatch(
      /not yet collapsed/
    );
    expect(
      summarizeSimulationGraph(
        sim({
          result: {
            futures_count: 3,
            chosen_future_name: "Invite-only",
            chosen_future_id: "f-a",
            graph_shape: "collapsed",
          },
        })
      )
    ).toMatch(/collapsed to “Invite-only”/);
    expect(
      summarizeSimulationGraph(
        sim({
          result: { futures_count: 2, graph_op: "rebranch_from_open" },
        })
      )
    ).toMatch(/re-branched/);
  });

  it("graphShapeForSimulation tracks open vs collapsed", () => {
    expect(graphShapeForSimulation(sim())).toBe("open_branches");
    expect(
      graphShapeForSimulation(
        sim({ result: { chosen_future_id: "f-a", graph_shape: "collapsed" } })
      )
    ).toBe("collapsed");
  });
});
