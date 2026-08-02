import { describe, expect, it } from "vitest";
import { deriveReplayComparison } from "./replayComparison";
import type { FutureRecord, SimulationRecord } from "./types";

const WS = "ws";

function sim(
  id: string,
  partial: { best?: string; confidence?: number; chosen?: string }
): SimulationRecord {
  return {
    id,
    workspace_id: WS,
    goal_id: null,
    title: "Q",
    status: "completed",
    confidence: partial.confidence ?? 0.7,
    result: {
      best_future: partial.best,
      chosen_future_id: partial.chosen,
    },
    created_at: "2026-01-01T00:00:00.000Z",
    version: 1,
    lineage_id: "L",
    parent_simulation_id: null,
    decision_id: "L",
  };
}

function futures(names: string[]): FutureRecord[] {
  return names.map((name, i) => ({
    id: `f${i}`,
    simulation_id: "s",
    name,
    score: 1 - i * 0.1,
    risk: 0.2,
    confidence: 0.7,
    summary: name,
  }));
}

describe("deriveReplayComparison", () => {
  it("detects a recommendation change after re-run", () => {
    const before = sim("a", { best: "Narrow beta", confidence: 0.7 });
    const after = sim("b", { best: "Enterprise first", confidence: 0.75 });
    const cmp = deriveReplayComparison(
      before,
      after,
      futures(["Narrow beta", "Enterprise first"]),
      futures(["Enterprise first", "Narrow beta"])
    );
    expect(cmp.recommendationChanged).toBe(true);
    expect(cmp.summary).toMatch(/Narrow beta/);
    expect(cmp.summary).toMatch(/Enterprise first/);
    expect(cmp.confidenceDelta).toBeCloseTo(0.05, 5);
  });

  it("reports a stable recommendation", () => {
    const before = sim("a", { best: "Ship MVP", confidence: 0.8 });
    const after = sim("b", { best: "Ship MVP", confidence: 0.8 });
    const f = futures(["Ship MVP", "Raise"]);
    const cmp = deriveReplayComparison(before, after, f, f);
    expect(cmp.recommendationChanged).toBe(false);
    expect(cmp.summary).toMatch(/stayed/);
  });
});
