import { describe, expect, it } from "vitest";
import {
  buildDecisionReport,
  deriveRecommendedBecause,
  deriveWhyReasons,
  exportDecisionReportMarkdown,
} from "./decisionReport";
import type { FutureRecord, SimulationRecord, WorkspaceHome } from "./types";

function homeWithSim(
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
      title: "Launch CLAB",
      description: "Ship public",
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
        title: "Brief",
        content: "bootstrap",
        metadata: {},
        created_at: "2026-01-02T00:00:00.000Z",
      },
    ],
    notes: [],
    futuresBySimulation: { [sim.id]: futures },
    timelineBySimulation: {},
  };
}

const futures: FutureRecord[] = [
  {
    id: "f1",
    simulation_id: "s1",
    name: "Private Beta First",
    score: 0.9,
    risk: 0.25,
    confidence: 0.88,
    summary: "Ship private beta before raise",
  },
  {
    id: "f2",
    simulation_id: "s1",
    name: "Raise First",
    score: 0.7,
    risk: 0.55,
    confidence: 0.6,
    summary: "Raise seed then launch",
  },
];

describe("decisionReport", () => {
  it("builds a recommended decision with confidence, why, risks, nextActions", () => {
    const sim: SimulationRecord = {
      id: "s1",
      workspace_id: "w1",
      goal_id: "g1",
      title: "Raise first?",
      status: "completed",
      confidence: 0.88,
      result: {
        best_future: "Private Beta First",
        recommendation: "Prefer private beta before capital raise.",
        risks: ["Runway pressure", "Market timing"],
      },
      created_at: "2026-01-03T00:00:00.000Z",
      version: 1,
      lineage_id: "L1",
      parent_simulation_id: null,
    };

    const report = buildDecisionReport(homeWithSim(sim, futures), sim, futures);
    expect(report.decisionTitle).toBe("Launch CLAB");
    expect(report.objective).toBe("Launch CLAB");
    expect(report.recommended).toBe("Private Beta First");
    expect(report.confidence).toBeCloseTo(0.88);
    expect(report.why.length).toBeGreaterThan(0);
    expect(report.risks).toContain("Runway pressure");
    expect(report.nextActions.length).toBeGreaterThan(0);
    expect(report.chosenFutureId).toBeNull();
    expect(report.alternatives.length).toBe(2);
    expect(report.tradeoffs.length).toBe(2);
    expect(report.contextUsed.some((c) => c.title === "Brief")).toBe(true);
    expect(report.recommendedBecause.length).toBeGreaterThan(0);
    expect(
      report.recommendedBecause.some((r) =>
        /risk|objective|success|confidence|dependencies|grounded/i.test(r)
      )
    ).toBe(true);
  });

  it("deriveRecommendedBecause prefers transparent trust bullets", () => {
    const sim: SimulationRecord = {
      id: "s1",
      workspace_id: "w1",
      goal_id: "g1",
      title: "Raise first?",
      status: "completed",
      confidence: 0.88,
      result: {},
      created_at: "2026-01-03T00:00:00.000Z",
      version: 1,
      lineage_id: "L1",
      parent_simulation_id: null,
    };
    const home = homeWithSim(sim, futures);
    const bullets = deriveRecommendedBecause(futures[0], futures, home.goal, sim, home);
    expect(bullets.some((b) => /lowest execution risk/i.test(b))).toBe(true);
    expect(bullets.some((b) => /fits your stated objective/i.test(b))).toBe(true);
    expect(bullets.some((b) => /highest expected success/i.test(b))).toBe(true);
  });

  it("prefers user-chosen path when present", () => {
    const sim: SimulationRecord = {
      id: "s1",
      workspace_id: "w1",
      goal_id: "g1",
      title: "Raise first?",
      status: "completed",
      confidence: 0.88,
      result: {
        best_future: "Private Beta First",
        chosen_future_id: "f2",
        chosen_future_name: "Raise First",
        chosen_at: "2026-01-04T00:00:00.000Z",
        recommendation: "Engine leaned beta.",
      },
      created_at: "2026-01-03T00:00:00.000Z",
      version: 1,
      lineage_id: "L1",
      parent_simulation_id: null,
    };

    const report = buildDecisionReport(homeWithSim(sim, futures), sim, futures);
    expect(report.recommended).toBe("Raise First");
    expect(report.chosenFutureId).toBe("f2");
    expect(report.engineBest).toBe("Private Beta First");
  });

  it("deriveWhyReasons and markdown export", () => {
    const sim: SimulationRecord = {
      id: "s1",
      workspace_id: "w1",
      goal_id: "g1",
      title: "Raise first?",
      status: "completed",
      confidence: 0.8,
      result: {
        recommendation: "Lean bootstrap.",
        chosen_future_id: "f1",
      },
      created_at: "2026-01-03T00:00:00.000Z",
      version: 1,
      lineage_id: "L1",
      parent_simulation_id: null,
    };
    const home = homeWithSim(sim, futures);
    const why = deriveWhyReasons(sim, futures[0], home.goal, home);
    expect(why.some((w) => /bootstrap|Lean/i.test(w))).toBe(true);

    const report = buildDecisionReport(home, sim, futures);
    const md = exportDecisionReportMarkdown(report);
    expect(md).toContain("# Decision Report");
    expect(md).toContain("## Goal");
    expect(md).toContain("## Simulation summary");
    expect(md).toContain("## Evidence");
    expect(md).toContain("## Recommendation");
    expect(md).toContain("## Why this was chosen");
    expect(md).toContain("## Expected value");
    expect(md).toContain("## Compare alternatives");
    expect(md).toContain("## Next actions");
    expect(md).toContain("## Save decision");
    expect(md).toContain(report.recommended);
    expect(report.evidence.strategiesGenerated).toBeGreaterThan(0);
    expect(report.expectedValue.rows.length).toBeGreaterThan(0);
  });
});
