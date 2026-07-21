import { describe, expect, it } from "vitest";
import {
  betaChecklistProgress,
  evaluateBetaChecklist,
  nextBetaChecklistItem,
} from "./betaChecklist";
import type { WorkspaceHome } from "./types";

function home(partial: Partial<WorkspaceHome> = {}): WorkspaceHome {
  return {
    workspace: {
      id: "w1",
      owner_id: "u1",
      name: "Lab",
      description: "",
      created_at: "2026-01-01T00:00:00.000Z",
    },
    goal: null,
    goalHistory: [],
    recentSimulations: [],
    knowledge: [],
    notes: [],
    futuresBySimulation: {},
    timelineBySimulation: {},
    ...partial,
  };
}

describe("betaChecklist", () => {
  it("starts with only optional LLM and share incomplete", () => {
    const items = evaluateBetaChecklist(home());
    expect(items.find((i) => i.id === "llm")?.optional).toBe(true);
    expect(items.find((i) => i.id === "decision")?.done).toBe(false);
    expect(nextBetaChecklistItem(items)?.id).toBe("decision");
  });

  it("unlocks decision → simulation → memory", () => {
    let h = home({
      goal: {
        id: "g1",
        workspace_id: "w1",
        title: "Launch beta",
        description: "",
        status: "active",
        priority: 1,
        created_at: "2026-01-01T00:00:00.000Z",
      },
    });
    expect(evaluateBetaChecklist(h).find((i) => i.id === "decision")?.done).toBe(true);

    h = home({
      goal: h.goal,
      recentSimulations: [
        {
          id: "s1",
          workspace_id: "w1",
          goal_id: "g1",
          title: "How to launch?",
          status: "completed",
          confidence: 0.8,
          result: {},
          created_at: "2026-01-02T00:00:00.000Z",
          version: 1,
          lineage_id: "L1",
          parent_simulation_id: null,
        },
      ],
    });
    expect(evaluateBetaChecklist(h).find((i) => i.id === "simulation")?.done).toBe(true);
    expect(evaluateBetaChecklist(h).find((i) => i.id === "memory")?.done).toBe(false);

    h = {
      ...h,
      recentSimulations: [
        {
          ...h.recentSimulations[0],
          result: { chosen_future_id: "f1", chosen_future_name: "Ship" },
        },
      ],
    };
    expect(evaluateBetaChecklist(h).find((i) => i.id === "memory")?.done).toBe(true);
  });

  it("computes required progress percent", () => {
    const items = evaluateBetaChecklist(home(), {
      llmProviderConnected: true,
      shareAcknowledged: true,
      preferredAuthProvider: "google",
    });
    // only share done among required when no goal/sim
    const p = betaChecklistProgress(items);
    expect(p.requiredTotal).toBe(4);
    expect(p.requiredDone).toBe(1);
    expect(p.percent).toBe(25);
  });
});
