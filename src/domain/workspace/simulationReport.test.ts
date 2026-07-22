import { describe, expect, it } from "vitest";
import {
  buildSimulationDetail,
  deriveTradeoffs,
  exportSimulationJson,
  exportSimulationMarkdown,
  resolveKnowledgeUsed,
  snapshotKnowledgeUsed,
} from "./simulationReport";
import type { FutureRecord, SimulationRecord, WorkspaceHome } from "./types";

const futures: FutureRecord[] = [
  {
    id: "f1",
    simulation_id: "s1",
    name: "Beta First",
    score: 0.9,
    risk: 0.2,
    confidence: 0.85,
    summary: "Private beta",
  },
  {
    id: "f2",
    simulation_id: "s1",
    name: "Raise First",
    score: 0.7,
    risk: 0.5,
    confidence: 0.6,
    summary: "Capital raise",
  },
];

function makeHome(sim: SimulationRecord): WorkspaceHome {
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
      description: "Public",
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
        type: "markdown",
        title: "Brief.md",
        content: "body",
        metadata: {},
        created_at: "2026-01-02T00:00:00.000Z",
      },
    ],
    notes: [
      {
        id: "n1",
        workspace_id: "w1",
        title: "Constraints",
        content: "no raise",
        created_at: "2026-01-02T00:00:00.000Z",
      },
    ],
    futuresBySimulation: { s1: futures },
    timelineBySimulation: {},
  };
}

describe("simulationReport", () => {
  it("snapshots and resolves knowledge used", () => {
    const home = makeHome({
      id: "s1",
      workspace_id: "w1",
      goal_id: "g1",
      title: "Raise?",
      status: "completed",
      confidence: 0.8,
      result: {},
      created_at: "2026-01-03T00:00:00.000Z",
      version: 1,
      lineage_id: "L1",
      parent_simulation_id: null,
    });

    const snap = snapshotKnowledgeUsed(home.knowledge, home.notes);
    expect(snap.some((k) => k.title === "Brief.md")).toBe(true);
    expect(snap.some((k) => k.title === "Constraints")).toBe(true);

    const withSnap: SimulationRecord = {
      ...home.recentSimulations[0],
      result: { knowledge_used: snap },
    };
    expect(resolveKnowledgeUsed(withSnap, home)).toHaveLength(snap.length);

    // Fall back to current library when not recorded
    expect(resolveKnowledgeUsed(home.recentSimulations[0], home).length).toBeGreaterThan(0);
  });

  it("derives tradeoffs vs best future", () => {
    const rows = deriveTradeoffs(futures);
    expect(rows[0].vsBest).toMatch(/baseline|best/i);
    expect(rows[1].vsBest.length).toBeGreaterThan(0);
  });

  it("builds detail and exports markdown/json", () => {
    const sim: SimulationRecord = {
      id: "s1",
      workspace_id: "w1",
      goal_id: "g1",
      title: "Raise?",
      status: "completed",
      confidence: 0.85,
      result: {
        recommendation: "Beta first",
        risks: ["Timing"],
        constraints: ["hard: no raise"],
        planner_tasks: ["Research", "Rank"],
        knowledge_used: [{ id: "k1", type: "markdown", title: "Brief.md" }],
      },
      created_at: "2026-01-03T00:00:00.000Z",
      version: 1,
      lineage_id: "L1",
      parent_simulation_id: null,
    };
    const home = makeHome(sim);
    const detail = buildSimulationDetail(home, sim);
    expect(detail.goalTitle).toBe("Launch");
    expect(detail.futures).toHaveLength(2);
    expect(detail.knowledgeUsed[0].title).toBe("Brief.md");
    expect(detail.tradeoffs).toHaveLength(2);

    const md = exportSimulationMarkdown(detail);
    expect(md).toContain("# Simulation:");
    expect(md).toContain("Beta first");
    expect(md).toContain("## Tradeoffs");

    const json = exportSimulationJson(detail);
    expect(JSON.parse(json).recommendation).toBe("Beta first");
  });
});
