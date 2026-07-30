import { describe, expect, it } from "vitest";
import { deriveDecisionCard } from "./decisionCard";
import type { FutureRecord, SimulationRecord, WorkspaceHome } from "./types";

function home(overrides: {
  sims?: SimulationRecord[];
  futures?: Record<string, FutureRecord[]>;
}): WorkspaceHome {
  const sims = overrides.sims ?? [];
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
      title: "Launch CLAB Public Beta",
      description: "Ship invite-only",
      status: "active",
      priority: 1,
      created_at: "2026-01-01T00:00:00.000Z",
    },
    goalHistory: [],
    decisions: [],
    recentSimulations: sims,
    knowledge: [],
    notes: [],
    futuresBySimulation: overrides.futures ?? {},
    timelineBySimulation: {},
  };
}

function sim(
  partial: Partial<SimulationRecord> & Pick<SimulationRecord, "id" | "status">
): SimulationRecord {
  return {
    workspace_id: "w1",
    goal_id: "g1",
    title: "How should we launch?",
    confidence: 0.91,
    result: {
      best_future: "Private Beta",
      recommendation: "Ship private beta first.",
    },
    created_at: "2026-01-02T00:00:00.000Z",
    version: 1,
    lineage_id: partial.id,
    parent_simulation_id: null,
    ...partial,
  };
}

const futures: FutureRecord[] = [
  {
    id: "f1",
    simulation_id: "s1",
    name: "Private Beta",
    score: 0.9,
    risk: 0.2,
    confidence: 0.91,
    summary: "Validate before scale",
  },
  {
    id: "f2",
    simulation_id: "s1",
    name: "Public Launch",
    score: 0.6,
    risk: 0.5,
    confidence: 0.6,
    summary: "Go wide now",
  },
];

describe("deriveDecisionCard", () => {
  it("needs_simulation: Run simulation deep-link, never commits", () => {
    const card = deriveDecisionCard(home({}));
    expect(card.status).toBe("needs_simulation");
    expect(card.primaryCtaLabel).toMatch(/run simulation/i);
    expect(card.primaryCtaHref).toBe("/workspace/simulations?new=1");
    expect(card.commitsDecision).toBe(false);
    expect(card.decisionTitle).toBe("Launch CLAB Public Beta");
  });

  it("pending_decision: Review Recommendation deep-links to sim detail", () => {
    const s = sim({
      id: "s1",
      status: "completed",
      result: { best_future: "Private Beta" },
    });
    const card = deriveDecisionCard(home({ sims: [s], futures: { s1: futures } }));
    expect(card.status).toBe("pending_decision");
    expect(card.recommendation).toBe("Private Beta");
    expect(card.primaryCtaLabel).toBe("Review Recommendation →");
    expect(card.primaryCtaHref).toBe("/workspace/simulations/s1");
    expect(card.commitsDecision).toBe(false);
    expect(card.primaryCtaLabel.toLowerCase()).not.toMatch(/accept|save decision/);
    expect(card.secondaryCtaHref).toContain("#compare-alternatives");
  });

  it("path_saved: Log outcome deep-link", () => {
    const s = sim({
      id: "s1",
      status: "completed",
      result: {
        best_future: "Private Beta",
        chosen_future_id: "f1",
        chosen_future_name: "Private Beta",
      },
    });
    const card = deriveDecisionCard(home({ sims: [s], futures: { s1: futures } }));
    expect(card.status).toBe("path_saved");
    expect(card.pathSaved).toBe(true);
    expect(card.primaryCtaLabel).toMatch(/log outcome/i);
    expect(card.primaryCtaHref).toBe("/workspace/simulations/s1");
    expect(card.commitsDecision).toBe(false);
  });

  it("complete: Open report when path + outcome present", () => {
    const s = sim({
      id: "s1",
      status: "completed",
      result: {
        best_future: "Private Beta",
        chosen_future_id: "f1",
        chosen_future_name: "Private Beta",
        outcome_followed: "yes",
        outcome_result: "Shipped well",
      },
    });
    const card = deriveDecisionCard(home({ sims: [s], futures: { s1: futures } }));
    expect(card.status).toBe("complete");
    expect(card.primaryCtaLabel).toMatch(/decision report/i);
    expect(card.commitsDecision).toBe(false);
  });

  it("running: open in-progress sim", () => {
    const s = sim({ id: "s-run", status: "running", confidence: null, result: {} });
    const card = deriveDecisionCard(home({ sims: [s] }));
    expect(card.status).toBe("running");
    expect(card.primaryCtaHref).toBe("/workspace/simulations/s-run");
  });

  it("failed: review failed run", () => {
    const s = sim({ id: "s-fail", status: "failed", confidence: null, result: {} });
    const card = deriveDecisionCard(home({ sims: [s] }));
    expect(card.status).toBe("failed");
    expect(card.primaryCtaLabel).toMatch(/failed/i);
  });
});
