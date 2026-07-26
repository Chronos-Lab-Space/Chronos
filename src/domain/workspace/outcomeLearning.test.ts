import { describe, expect, it } from "vitest";
import {
  deriveOutcomeLearning,
  PRIOR_WEIGHT,
  priorWeight,
  selectWeightedPreferences,
} from "./outcomeLearning";
import type { LearningMemoryRecord } from "./productLearning";

function pref(simulationId: string, content: string, createdAt: string): LearningMemoryRecord {
  return {
    id: `pref-${simulationId}-${content}`,
    workspaceId: "w1",
    simulationId,
    kind: "preference",
    content,
    metadata: {},
    createdAt,
  };
}

describe("priorWeight", () => {
  it("drops priors from runs whose outcome missed", () => {
    expect(priorWeight({ verdict: "worse" })).toBe(PRIOR_WEIGHT.missed);
  });

  it("boosts priors from runs that beat the prediction", () => {
    expect(priorWeight({ verdict: "better" })).toBeGreaterThan(PRIOR_WEIGHT.unknown);
    expect(priorWeight({ verdict: "as_expected" })).toBeGreaterThan(PRIOR_WEIGHT.unknown);
  });

  it("treats an un-logged outcome as today's neutral behavior", () => {
    expect(priorWeight(undefined)).toBe(PRIOR_WEIGHT.unknown);
    expect(priorWeight({})).toBe(PRIOR_WEIGHT.unknown);
  });

  it("demotes but does not drop a recommendation that was never followed", () => {
    const w = priorWeight({ followed: "no" });
    expect(w).toBeLessThan(PRIOR_WEIGHT.unknown);
    expect(w).toBeGreaterThan(PRIOR_WEIGHT.missed);
  });

  it("a logged verdict outranks the followed signal", () => {
    expect(priorWeight({ followed: "no", verdict: "better" })).toBe(PRIOR_WEIGHT.better);
  });
});

describe("selectWeightedPreferences", () => {
  const records = [
    pref("missed-run", "avoid A", "2026-01-05T00:00:00.000Z"),
    pref("good-run", "prefer B", "2026-01-01T00:00:00.000Z"),
    pref("unlogged-run", "prefer C", "2026-01-04T00:00:00.000Z"),
  ];

  it("excludes priors from a run that missed, even when newest", () => {
    const picked = selectWeightedPreferences(records, {
      "missed-run": { verdict: "worse" },
      "good-run": { verdict: "better" },
    });
    expect(picked).not.toContain("avoid A");
  });

  it("ranks a proven prior above an unproven one despite being older", () => {
    const picked = selectWeightedPreferences(records, {
      "good-run": { verdict: "better" },
    });
    expect(picked[0]).toBe("prefer B");
  });

  it("preserves current behavior when no outcomes are logged (recency order)", () => {
    const picked = selectWeightedPreferences(records, {});
    expect(picked).toEqual(["avoid A", "prefer C", "prefer B"]);
  });

  it("dedupes identical hints and honors the limit", () => {
    const dupes = [
      pref("r1", "same hint", "2026-01-02T00:00:00.000Z"),
      pref("r2", "same hint", "2026-01-01T00:00:00.000Z"),
      pref("r3", "other hint", "2026-01-03T00:00:00.000Z"),
    ];
    expect(selectWeightedPreferences(dupes, {})).toEqual(["other hint", "same hint"]);
    expect(selectWeightedPreferences(dupes, {}, 1)).toEqual(["other hint"]);
  });

  it("ignores non-preference records", () => {
    const mixed = [
      { ...pref("r1", "hint", "2026-01-01T00:00:00.000Z"), kind: "outcome" as const },
      pref("r2", "real hint", "2026-01-02T00:00:00.000Z"),
    ];
    expect(selectWeightedPreferences(mixed, {})).toEqual(["real hint"]);
  });
});

describe("deriveOutcomeLearning", () => {
  const base = { workspaceId: "w1", simulationId: "s1", now: "2026-02-01T00:00:00.000Z" };

  it("records nothing before the user reports anything", () => {
    expect(deriveOutcomeLearning(base)).toEqual([]);
  });

  it("records adoption from the followed signal", () => {
    const [record] = deriveOutcomeLearning({ ...base, followed: "yes", pathName: "Staged launch" });
    expect(record?.kind).toBe("outcome");
    expect(record?.content).toContain("Followed the recommendation");
    expect(record?.content).toContain("Staged launch");
    expect(record?.metadata.observed).toBe(true);
  });

  it("states a miss plainly and carries the drop weight", () => {
    const records = deriveOutcomeLearning({
      ...base,
      followed: "yes",
      verdict: "worse",
      resultNote: "Churn doubled.",
    });
    const result = records.find((r) => r.metadata.learningKey === "result:s1");
    expect(result?.content).toBe("Outcome missed the prediction: Churn doubled.");
    expect(result?.metadata.priorWeight).toBe(PRIOR_WEIGHT.missed);
  });

  it("keeps a free-text result even with no verdict", () => {
    const records = deriveOutcomeLearning({ ...base, resultNote: "Shipped late but fine." });
    expect(records).toHaveLength(1);
    expect(records[0]?.content).toContain("Shipped late but fine.");
  });

  it("is idempotent — re-logging the same run reuses ids", () => {
    const a = deriveOutcomeLearning({ ...base, followed: "yes", verdict: "better" });
    const b = deriveOutcomeLearning({ ...base, followed: "yes", verdict: "better" });
    expect(a.map((r) => r.id)).toEqual(b.map((r) => r.id));
  });
});
