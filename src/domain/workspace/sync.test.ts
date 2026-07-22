import { describe, expect, it } from "vitest";
import { hasLocalMemory, mergeWorkspaceHomes } from "./sync";
import type { WorkspaceHome } from "./types";

function baseHome(overrides: Partial<WorkspaceHome> = {}): WorkspaceHome {
  return {
    workspace: {
      id: "ws-1",
      owner_id: "user-1",
      name: "Remote HQ",
      description: "cloud",
      created_at: "2026-07-01T00:00:00.000Z",
    },
    goal: {
      id: "g-1",
      workspace_id: "ws-1",
      title: "Ship product",
      description: "",
      status: "active",
      priority: 1,
      created_at: "2026-07-01T00:00:00.000Z",
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

describe("mergeWorkspaceHomes", () => {
  it("unions simulations and keeps remote goal metadata", () => {
    const remote = baseHome({
      recentSimulations: [
        {
          id: "sim-r",
          workspace_id: "ws-1",
          goal_id: "g-1",
          title: "Remote sim",
          status: "completed",
          confidence: 0.8,
          result: { best_future: "A" },
          created_at: "2026-07-10T00:00:00.000Z",
          version: 1,
          lineage_id: "lin-r",
          parent_simulation_id: null,
        },
      ],
      futuresBySimulation: {
        "sim-r": [
          {
            id: "f-r",
            simulation_id: "sim-r",
            name: "Future A",
            score: 0.9,
            risk: 0.2,
            confidence: 0.8,
            summary: "remote",
          },
        ],
      },
    });

    const local = baseHome({
      workspace: {
        id: "ws-1",
        owner_id: "user-1",
        name: "Local HQ",
        description: "local only",
        created_at: "2026-07-01T00:00:00.000Z",
      },
      goal: null,
      goalHistory: [],
      recentSimulations: [
        {
          id: "sim-l",
          workspace_id: "ws-1",
          goal_id: null,
          title: "Local sim",
          status: "completed",
          confidence: 0.6,
          result: { best_future: "B" },
          created_at: "2026-07-11T00:00:00.000Z",
          version: 1,
          lineage_id: "lin-l",
          parent_simulation_id: null,
        },
      ],
      knowledge: [
        {
          id: "k-1",
          workspace_id: "ws-1",
          type: "note",
          title: "Local note",
          content: "context",
          metadata: {},
          created_at: "2026-07-11T00:00:00.000Z",
        },
      ],
      futuresBySimulation: {
        "sim-l": [
          {
            id: "f-l",
            simulation_id: "sim-l",
            name: "Future B",
            score: 0.7,
            risk: 0.3,
            confidence: 0.6,
            summary: "local",
          },
        ],
      },
    });

    const merged = mergeWorkspaceHomes(remote, local);
    expect(merged.workspace.name).toBe("Remote HQ");
    expect(merged.goal?.title).toBe("Ship product");
    expect(merged.recentSimulations.map((s) => s.id).sort()).toEqual(["sim-l", "sim-r"]);
    expect(merged.knowledge).toHaveLength(1);
    expect(merged.futuresBySimulation["sim-r"]).toHaveLength(1);
    expect(merged.futuresBySimulation["sim-l"]).toHaveLength(1);
  });

  it("hasLocalMemory detects empty vs populated homes", () => {
    expect(hasLocalMemory(baseHome({ goal: null, workspace: {
      id: "ws-1",
      owner_id: "user-1",
      name: "X",
      description: "",
      created_at: "2026-07-01T00:00:00.000Z",
    }}))).toBe(true);
    expect(
      hasLocalMemory(
        baseHome({
          goal: null,
          goalHistory: [],
          recentSimulations: [
            {
              id: "s",
              workspace_id: "ws-1",
              goal_id: null,
              title: "t",
              status: "completed",
              confidence: 1,
              result: {},
              created_at: "2026-07-01T00:00:00.000Z",
              version: 1,
              lineage_id: "s",
              parent_simulation_id: null,
            },
          ],
        })
      )
    ).toBe(true);
  });
});
