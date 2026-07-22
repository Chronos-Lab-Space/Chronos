import { describe, expect, it } from "vitest";
import type { WorkspaceHome } from "../../domain/workspace/types";
import { WorkspaceGrokService } from "./WorkspaceGrokService";

const home: WorkspaceHome = {
  workspace: {
    id: "w1",
    owner_id: "u1",
    name: "Chronos Lab",
    description: "HQ",
    created_at: "2026-01-01T00:00:00.000Z",
  },
  goal: {
    id: "g1",
    workspace_id: "w1",
    title: "Launch CLAB on Kickstart",
    description: "Public launch",
    status: "active",
    priority: 1,
    created_at: "2026-01-01T00:00:00.000Z",
  },
  goalHistory: [],
  recentSimulations: [
    {
      id: "s1",
      workspace_id: "w1",
      goal_id: "g1",
      title: "Raise funding?",
      status: "completed",
      confidence: 0.8,
      result: {
        best_future: "Bootstrap",
        recommendation: "Stay lean",
        risks: ["Runway"],
      },
      created_at: "2026-01-02T00:00:00.000Z",
      version: 1,
      lineage_id: "L1",
      parent_simulation_id: null,
    },
  ],
  knowledge: [
    {
      id: "k1",
      workspace_id: "w1",
      type: "markdown",
      title: "Brief",
      content: "Market notes here",
      metadata: {},
      created_at: "2026-01-01T00:00:00.000Z",
    },
  ],
  notes: [],
  futuresBySimulation: {
    s1: [
      {
        id: "f1",
        simulation_id: "s1",
        name: "Bootstrap",
        score: 0.8,
        risk: 0.2,
        confidence: 0.8,
        summary: "Capital efficient",
      },
    ],
  },
  timelineBySimulation: {},
};

describe("WorkspaceGrokService", () => {
  it("builds workspace context including goal, knowledge, and sims", () => {
    const ctx = new WorkspaceGrokService().buildContext(home, { simulationId: "s1" });
    expect(ctx).toContain("Chronos Lab");
    expect(ctx).toContain("Launch CLAB on Kickstart");
    expect(ctx).toContain("Brief");
    expect(ctx).toContain("Bootstrap");
    expect(ctx).toContain("Focus simulation report");
  });
});
