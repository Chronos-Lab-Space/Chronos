import { describe, expect, it } from "vitest";
import {
  decisionHistoryPreview,
  deriveDecisionHistory,
} from "./decisionHistory";
import type { SimulationRecord, WorkspaceHome } from "./types";

function baseHome(sims: SimulationRecord[] = []): WorkspaceHome {
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
      title: "Launch CLAB",
      description: "",
      status: "active",
      priority: 1,
      created_at: "2026-01-01T12:00:00.000Z",
    },
    goalHistory: [],
    recentSimulations: sims,
    knowledge: [
      {
        id: "k1",
        workspace_id: "w1",
        type: "note",
        title: "Brief",
        content: "x",
        metadata: {},
        created_at: "2026-01-01T18:00:00.000Z",
      },
    ],
    notes: [],
    futuresBySimulation: {},
    timelineBySimulation: {},
  };
}

function completedSim(
  id: string,
  created_at: string,
  result: SimulationRecord["result"] = { best_future: "Private Beta" }
): SimulationRecord {
  return {
    id,
    workspace_id: "w1",
    goal_id: "g1",
    title: "Sim",
    status: "completed",
    confidence: 0.9,
    result,
    created_at,
    version: 1,
    lineage_id: id,
    parent_simulation_id: null,
  };
}

describe("deriveDecisionHistory", () => {
  it("builds workspace → goal → knowledge narrative without sims", () => {
    const events = deriveDecisionHistory(baseHome());
    expect(events.map((e) => e.kind)).toEqual([
      "workspace_created",
      "goal_set",
      "knowledge_added",
    ]);
    expect(events[0]!.label).toBe("Workspace created");
    expect(events[2]!.label).toMatch(/knowledge added/i);
  });

  it("adds simulation, recommendation, accept, outcome in order", () => {
    const sim = completedSim("s1", "2026-01-02T00:00:00.000Z", {
      best_future: "Private Beta",
      chosen_future_id: "f1",
      chosen_future_name: "Private Beta",
      chosen_at: "2026-01-02T01:00:00.000Z",
      outcome_followed: "yes",
      outcome_followed_at: "2026-01-02T02:00:00.000Z",
      outcome_result: "Shipped",
      outcome_result_at: "2026-01-02T03:00:00.000Z",
    });
    const events = deriveDecisionHistory(baseHome([sim]));
    const kinds = events.map((e) => e.kind);
    expect(kinds).toContain("simulation_completed");
    expect(kinds).toContain("recommendation_ready");
    expect(kinds).toContain("decision_accepted");
    expect(kinds).toContain("outcome_logged");

    const simIdx = kinds.indexOf("simulation_completed");
    const recIdx = kinds.indexOf("recommendation_ready");
    const accIdx = kinds.indexOf("decision_accepted");
    const outIdx = kinds.indexOf("outcome_logged");
    expect(simIdx).toBeLessThan(recIdx);
    expect(recIdx).toBeLessThan(accIdx);
    expect(accIdx).toBeLessThan(outIdx);

    expect(events.find((e) => e.kind === "decision_accepted")?.label).toMatch(
      /Private Beta/
    );
  });

  it("preview returns newest first, capped", () => {
    const sims = [
      completedSim("s1", "2026-01-02T00:00:00.000Z"),
      completedSim("s2", "2026-01-03T00:00:00.000Z", {
        best_future: "B",
        chosen_future_id: "f2",
        chosen_future_name: "B",
        chosen_at: "2026-01-03T01:00:00.000Z",
      }),
    ];
    const preview = decisionHistoryPreview(baseHome(sims), 3);
    expect(preview).toHaveLength(3);
    // Newest activity first
    expect(preview[0]!.at >= preview[1]!.at).toBe(true);
  });

  it("is the single source: full and preview share ids from same derive", () => {
    const sim = completedSim("s1", "2026-01-02T00:00:00.000Z", {
      best_future: "A",
      chosen_future_id: "f1",
      chosen_at: "2026-01-02T02:00:00.000Z",
    });
    const h = baseHome([sim]);
    const full = deriveDecisionHistory(h);
    const preview = decisionHistoryPreview(h, 5);
    const fullIds = new Set(full.map((e) => e.id));
    for (const e of preview) {
      expect(fullIds.has(e.id)).toBe(true);
    }
  });
});
