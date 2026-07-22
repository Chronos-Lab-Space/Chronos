import { describe, expect, it } from "vitest";
import { evaluateMvpGates, nextMvpGate } from "./mvpGates";
import type { WorkspaceHome } from "./types";

function baseHome(overrides: Partial<WorkspaceHome> = {}): WorkspaceHome {
  return {
    workspace: {
      id: "w1",
      owner_id: "u1",
      name: "Chronos Lab",
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
      created_at: "2026-01-01T00:00:00.000Z",
    },
    goalHistory: [],
    recentSimulations: [],
    knowledge: [],
    notes: [],
    futuresBySimulation: {},
    timelineBySimulation: {},
    ...overrides,
  };
}

describe("MVP phase gates", () => {
  it("starts with context as the next usable step after workspace+goal", () => {
    const home = baseHome();
    const gates = evaluateMvpGates(home);
    expect(gates.find((g) => g.id === "workspace")?.done).toBe(true);
    expect(gates.find((g) => g.id === "context")?.done).toBe(false);
    expect(nextMvpGate(home)?.id).toBe("context");
  });

  it("unlocks simulate → timeline → memory as work accumulates", () => {
    const withContext = baseHome({
      knowledge: [
        {
          id: "k1",
          workspace_id: "w1",
          type: "markdown",
          title: "Brief",
          content: "notes",
          metadata: {},
          created_at: "2026-01-01T00:00:00.000Z",
        },
      ],
    });
    expect(nextMvpGate(withContext)?.id).toBe("simulate");

    const withSim = baseHome({
      knowledge: withContext.knowledge,
      recentSimulations: [
        {
          id: "s1",
          workspace_id: "w1",
          goal_id: "g1",
          title: "Raise?",
          status: "completed",
          confidence: 0.8,
          result: { best_future: "Bootstrap" },
          created_at: "2026-01-02T00:00:00.000Z",
          version: 1,
          lineage_id: "L1",
          parent_simulation_id: null,
        },
      ],
      futuresBySimulation: {
        s1: [
          {
            id: "f1",
            simulation_id: "s1",
            name: "Bootstrap",
            score: 0.8,
            risk: 0.2,
            confidence: 0.8,
            summary: "lean",
          },
        ],
      },
    });
    expect(withSim.recentSimulations).toHaveLength(1);
    expect(evaluateMvpGates(withSim).find((g) => g.id === "timeline")?.done).toBe(true);
    expect(nextMvpGate(withSim)?.id).toBe("memory");

    const withHistory = baseHome({
      ...withSim,
      recentSimulations: [
        {
          ...withSim.recentSimulations[0],
          id: "s2",
          version: 2,
          parent_simulation_id: "s1",
          created_at: "2026-01-03T00:00:00.000Z",
        },
        withSim.recentSimulations[0],
      ],
      futuresBySimulation: {
        ...withSim.futuresBySimulation,
        s2: withSim.futuresBySimulation.s1,
      },
    });
    expect(nextMvpGate(withHistory)).toBeNull();
  });
});
