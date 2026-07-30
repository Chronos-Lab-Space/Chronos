import { describe, expect, it } from "vitest";
import type {
  FutureRecord,
  GoalRecord,
  SimulationRecord,
  TimelineNodeRecord,
  WorkspaceHome,
} from "../../domain/workspace/types";
import { buildSavePayload } from "./SupabaseWorkspaceRepository";

function sim(id: string, parent: string | null, created_at: string): SimulationRecord {
  return {
    id,
    workspace_id: "w1",
    goal_id: null,
    title: id,
    status: "completed",
    confidence: 1,
    result: {},
    created_at,
    version: parent ? 2 : 1,
    lineage_id: "L",
    parent_simulation_id: parent,
  };
}

function future(id: string, simulation_id: string): FutureRecord {
  return { id, simulation_id, name: id, score: 1, risk: 0, confidence: 1, summary: "" };
}

function node(
  id: string,
  simulation_id: string,
  parent_id: string | null,
  depth: number
): TimelineNodeRecord {
  return { id, simulation_id, parent_id, title: id, depth, score: 0 };
}

const goal: GoalRecord = {
  id: "g1",
  workspace_id: "w1",
  title: "ship it",
  description: "",
  status: "active",
  priority: 0,
  created_at: "2026-07-01T00:00:00.000Z",
};

function home(overrides: Partial<WorkspaceHome> = {}): WorkspaceHome {
  const parent = sim("s-parent", null, "2026-07-01T00:00:00.000Z");
  const child = sim("s-child", "s-parent", "2026-07-02T00:00:00.000Z");

  return {
    workspace: {
      id: "w1",
      owner_id: "u1",
      name: "Workspace",
      description: "",
      created_at: "2026-07-01T00:00:00.000Z",
    },
    goal,
    goalHistory: [],
    decisions: [],
    recentSimulations: [child, parent], // deliberately out of order
    knowledge: [],
    notes: [],
    futuresBySimulation: {
      "s-parent": [future("f-parent", "s-parent")],
      "s-child": [future("f-child", "s-child")],
    },
    timelineBySimulation: {
      "s-parent": [node("t-p1", "s-parent", "t-p0", 1), node("t-p0", "s-parent", null, 0)],
      "s-child": [node("t-c0", "s-child", null, 0)],
    },
    ...overrides,
  };
}

describe("buildSavePayload", () => {
  it("emits exactly the keys save_workspace_home reads", () => {
    expect(Object.keys(buildSavePayload(home())).sort()).toEqual([
      "decisions",
      "futures",
      "goal",
      "knowledge",
      "notes",
      "simulations",
      "timeline_nodes",
      "workspace",
    ]);
  });

  it("flattens futures and timeline nodes across every simulation", () => {
    const payload = buildSavePayload(home()) as Record<string, { id: string }[]>;

    expect(payload.futures.map((f) => f.id).sort()).toEqual(["f-child", "f-parent"]);
    expect(payload.timeline_nodes.map((n) => n.id).sort()).toEqual(["t-c0", "t-p0", "t-p1"]);
  });

  it("orders simulations parents-first and timeline nodes shallowest-first", () => {
    const payload = buildSavePayload(home()) as Record<string, { id: string }[]>;

    expect(payload.simulations.map((s) => s.id)).toEqual(["s-parent", "s-child"]);

    const depths = (payload.timeline_nodes as unknown as TimelineNodeRecord[]).map((n) => n.depth);
    expect(depths).toEqual([...depths].sort((a, b) => a - b));
  });

  it("passes a null goal through as null rather than omitting it", () => {
    const payload = buildSavePayload(home({ goal: null }));
    expect(payload.goal).toBeNull();
  });

  it("defaults nullable text and jsonb columns rather than sending null", () => {
    const payload = buildSavePayload(
      home({
        knowledge: [
          {
            id: "k1",
            workspace_id: "w1",
            type: "note",
            title: "k",
            content: undefined as unknown as string,
            metadata: undefined as unknown as Record<string, unknown>,
            created_at: "2026-07-01T00:00:00.000Z",
          },
        ],
      })
    ) as Record<string, Record<string, unknown>[]>;

    expect(payload.knowledge[0].content).toBe("");
    expect(payload.knowledge[0].metadata).toEqual({});
  });

  it("handles an empty workspace without producing nulls for the collections", () => {
    const payload = buildSavePayload(
      home({
        recentSimulations: [],
        futuresBySimulation: {},
        timelineBySimulation: {},
      })
    ) as Record<string, unknown[]>;

    expect(payload.simulations).toEqual([]);
    expect(payload.futures).toEqual([]);
    expect(payload.timeline_nodes).toEqual([]);
  });
});
