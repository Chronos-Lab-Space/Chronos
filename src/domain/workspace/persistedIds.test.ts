import { describe, expect, it } from "vitest";
import { isUuid, sanitizeWorkspaceHomeIds } from "./persistedIds";
import type { WorkspaceHome } from "./types";

function baseHome(): WorkspaceHome {
  return {
    workspace: {
      id: "11111111-1111-4111-8111-111111111111",
      owner_id: "22222222-2222-4222-8222-222222222222",
      name: "Lab",
      description: "",
      created_at: "2026-01-01T00:00:00.000Z",
    },
    goal: null,
    goalHistory: [],
    decisions: [],
    recentSimulations: [
      {
        id: "33333333-3333-4333-8333-333333333333",
        workspace_id: "11111111-1111-4111-8111-111111111111",
        goal_id: null,
        title: "Sim",
        status: "completed",
        confidence: 0.5,
        result: { chosen_future_id: "0x8d21", chosen_future_name: "Path A" },
        created_at: "2026-01-02T00:00:00.000Z",
        version: 1,
        lineage_id: "33333333-3333-4333-8333-333333333333",
        parent_simulation_id: null,
      },
    ],
    knowledge: [],
    notes: [],
    futuresBySimulation: {
      "33333333-3333-4333-8333-333333333333": [
        {
          id: "0x8d21",
          simulation_id: "33333333-3333-4333-8333-333333333333",
          name: "Path A",
          score: 0.9,
          risk: 0.2,
          confidence: 0.8,
          summary: "demo",
        },
      ],
    },
    timelineBySimulation: {
      "33333333-3333-4333-8333-333333333333": [
        {
          id: "node-root",
          simulation_id: "33333333-3333-4333-8333-333333333333",
          parent_id: null,
          title: "Root",
          depth: 0,
          score: 1,
        },
        {
          id: "node-child",
          simulation_id: "33333333-3333-4333-8333-333333333333",
          parent_id: "node-root",
          title: "Child",
          depth: 1,
          score: 0.5,
        },
      ],
    },
  };
}

describe("sanitizeWorkspaceHomeIds", () => {
  it("remints non-uuid future ids and rewrites chosen_future_id", () => {
    const home = sanitizeWorkspaceHomeIds(baseHome());
    const simId = home.recentSimulations[0].id;
    const futures = home.futuresBySimulation[simId];
    expect(futures).toHaveLength(1);
    expect(isUuid(futures[0].id)).toBe(true);
    expect(futures[0].id.startsWith("0x")).toBe(false);
    expect(home.recentSimulations[0].result.chosen_future_id).toBe(futures[0].id);
  });

  it("remints timeline node ids and parent links", () => {
    const home = sanitizeWorkspaceHomeIds(baseHome());
    const simId = home.recentSimulations[0].id;
    const nodes = home.timelineBySimulation[simId];
    expect(nodes.every((n) => isUuid(n.id))).toBe(true);
    const root = nodes.find((n) => n.depth === 0)!;
    const child = nodes.find((n) => n.depth === 1)!;
    expect(child.parent_id).toBe(root.id);
  });

  it("drops unmappable chosen_future_id as undefined (no collapse)", () => {
    const dirty = baseHome();
    dirty.recentSimulations[0].result.chosen_future_id = "0xdead-orphan";
    dirty.futuresBySimulation["33333333-3333-4333-8333-333333333333"] = [];
    const home = sanitizeWorkspaceHomeIds(dirty);
    expect(home.recentSimulations[0].result.chosen_future_id).toBeUndefined();
  });
});
