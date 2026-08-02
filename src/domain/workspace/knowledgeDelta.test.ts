import { describe, expect, it } from "vitest";
import { deriveKnowledgeDelta } from "./knowledgeDelta";
import type { SimulationRecord, WorkspaceHome } from "./types";

const WS = "11111111-1111-4111-8111-111111111111";

function home(partial: {
  knowledge?: WorkspaceHome["knowledge"];
  notes?: WorkspaceHome["notes"];
  sim: SimulationRecord;
}): WorkspaceHome {
  return {
    workspace: {
      id: WS,
      owner_id: "u1",
      name: "Lab",
      description: "",
      created_at: "2026-01-01T00:00:00.000Z",
    },
    goal: null,
    goalHistory: [],
    recentSimulations: [partial.sim],
    decisions: [],
    knowledge: partial.knowledge ?? [],
    notes: partial.notes ?? [],
    futuresBySimulation: {},
    timelineBySimulation: {},
  };
}

function sim(knowledge_used: unknown): SimulationRecord {
  return {
    id: "s1",
    workspace_id: WS,
    goal_id: null,
    title: "Launch?",
    status: "completed",
    confidence: 0.7,
    result: { knowledge_used },
    created_at: "2026-01-01T00:00:00.000Z",
    version: 1,
    lineage_id: "s1",
    parent_simulation_id: null,
    decision_id: "s1",
  };
}

describe("deriveKnowledgeDelta", () => {
  it("reports items added to the library since the run", () => {
    const s = sim([{ id: "k1", type: "note", title: "Constraints" }]);
    const h = home({
      sim: s,
      knowledge: [
        {
          id: "k1",
          workspace_id: WS,
          type: "markdown",
          title: "Constraints",
          content: "…",
          metadata: {},
          created_at: "2026-01-01T00:00:00.000Z",
        },
        {
          id: "k2",
          workspace_id: WS,
          type: "markdown",
          title: "New competitor note",
          content: "…",
          metadata: {},
          created_at: "2026-02-01T00:00:00.000Z",
        },
      ],
    });

    const delta = deriveKnowledgeDelta(h, s);
    expect(delta.hasChanges).toBe(true);
    expect(delta.added.map((a) => a.id)).toEqual(["k2"]);
    expect(delta.removed).toEqual([]);
    expect(delta.unchanged).toBe(1);
  });

  it("reports items removed from the library since the run", () => {
    const s = sim([
      { id: "k1", type: "note", title: "Old" },
      { id: "k2", type: "note", title: "Keep" },
    ]);
    const h = home({
      sim: s,
      knowledge: [
        {
          id: "k2",
          workspace_id: WS,
          type: "markdown",
          title: "Keep",
          content: "…",
          metadata: {},
          created_at: "2026-01-01T00:00:00.000Z",
        },
      ],
    });

    const delta = deriveKnowledgeDelta(h, s);
    expect(delta.removed.map((r) => r.id)).toEqual(["k1"]);
    expect(delta.added).toEqual([]);
  });

  it("has no changes when the library matches the snapshot", () => {
    const s = sim([{ id: "k1", type: "note", title: "Only" }]);
    const h = home({
      sim: s,
      knowledge: [
        {
          id: "k1",
          workspace_id: WS,
          type: "markdown",
          title: "Only",
          content: "…",
          metadata: {},
          created_at: "2026-01-01T00:00:00.000Z",
        },
      ],
    });

    const delta = deriveKnowledgeDelta(h, s);
    expect(delta.hasChanges).toBe(false);
    expect(delta.unchanged).toBe(1);
  });

  it("is pure — does not mutate home or simulation", () => {
    const s = sim([{ id: "k1", type: "note", title: "A" }]);
    const h = home({ sim: s, knowledge: [] });
    const before = JSON.stringify({ s, h });
    deriveKnowledgeDelta(h, s);
    expect(JSON.stringify({ s, h })).toBe(before);
  });
});
