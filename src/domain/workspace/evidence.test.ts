import { describe, expect, it } from "vitest";
import { buildDecisionEvidence } from "./evidence";
import type { FutureRecord, SimulationRecord, WorkspaceHome } from "./types";

function base(
  sim: SimulationRecord,
  futures: FutureRecord[] = []
): WorkspaceHome {
  return {
    workspace: {
      id: "w1",
      owner_id: "u1",
      name: "Lab",
      description: "",
      created_at: "2026-01-01T00:00:00.000Z",
    },
    goal: {
      id: "g1",
      workspace_id: "w1",
      title: "Launch",
      description: "",
      status: "active",
      priority: 1,
      created_at: "2026-01-01T00:00:00.000Z",
    },
    goalHistory: [],
    recentSimulations: [sim],
    knowledge: [
      {
        id: "k1",
        workspace_id: "w1",
        type: "note",
        title: "Ctx",
        content: "bootstrap",
        metadata: {},
        created_at: "2026-01-01T00:00:00.000Z",
      },
    ],
    notes: [],
    futuresBySimulation: { [sim.id]: futures },
    timelineBySimulation: {},
  };
}

describe("buildDecisionEvidence", () => {
  it("counts knowledge, constraints, strategies and marks criteria", () => {
    const sim: SimulationRecord = {
      id: "s1",
      workspace_id: "w1",
      goal_id: "g1",
      title: "Decide launch",
      status: "completed",
      confidence: 0.8,
      result: {
        constraints: ["hard: no raise", "soft: ship in 8 weeks"],
        futures_count: 2,
        paths_evaluated: 64,
        disqualified_count: 1,
        knowledge_used: [{ id: "k1", type: "note", title: "Ctx" }],
      },
      created_at: "2026-01-02T00:00:00.000Z",
      version: 1,
      lineage_id: "s1",
      parent_simulation_id: null,
    };
    const futures: FutureRecord[] = [
      {
        id: "f1",
        simulation_id: "s1",
        name: "Bootstrap",
        score: 0.9,
        risk: 0.2,
        confidence: 0.85,
        summary: "Lean launch",
      },
      {
        id: "f2",
        simulation_id: "s1",
        name: "Raise",
        score: 0.5,
        risk: 0.6,
        confidence: 0.5,
        summary: "Raise first",
      },
    ];
    const e = buildDecisionEvidence(base(sim, futures), sim, futures);
    expect(e.knowledgeSourcesUsed).toBeGreaterThanOrEqual(1);
    expect(e.constraintsEvaluated).toBe(2);
    expect(e.strategiesGenerated).toBe(2);
    expect(e.pathsEvaluated).toBe(64);
    expect(e.disqualifiedCount).toBe(1);
    expect(e.criteria.find((c) => c.id === "risk")?.evaluated).toBe(true);
    expect(e.criteria.some((c) => c.evaluated)).toBe(true);
  });
});
