import { describe, expect, it } from "vitest";
import { evaluateFutures, evaluateFuturesInGivenOrder, expectedValueOf } from "./futureEvaluation";

describe("futureEvaluation", () => {
  it("ranks by expected value and picks a clear winner", () => {
    const result = evaluateFutures([
      { id: "a", name: "Risky bet", score: 0.9, risk: 0.8, confidence: 0.9 },
      { id: "b", name: "Steady path", score: 0.75, risk: 0.2, confidence: 0.85 },
      { id: "c", name: "Weak", score: 0.4, risk: 0.3, confidence: 0.5 },
    ]);

    expect(result.best?.id).toBe("b");
    expect(result.ranked.map((f) => f.id)).toEqual(["b", "a", "c"]);
    expect(result.ranked[0].rank).toBe(1);
    expect(result.edge).toBeGreaterThan(0);
    expect(result.rationale).toContain("Steady path");
  });

  it("flags extreme risk as policy non-compliant", () => {
    const result = evaluateFutures([
      { id: "x", name: "Cliff", score: 1, risk: 0.9, confidence: 1 },
    ]);
    expect(result.best?.policyCompliant).toBe(false);
    expect(result.policyCompliant).toBe(false);
  });

  it("annotates without re-ranking when the caller's order is authoritative", () => {
    // Same fixture as the re-ranking test: EV order would be b > a > c,
    // but the product's decision order (engine ranking) must be preserved.
    const result = evaluateFuturesInGivenOrder([
      { id: "a", name: "Risky bet", score: 0.9, risk: 0.8, confidence: 0.9 },
      { id: "b", name: "Steady path", score: 0.75, risk: 0.2, confidence: 0.85 },
      { id: "c", name: "Weak", score: 0.4, risk: 0.3, confidence: 0.5 },
    ]);

    expect(result.ranked.map((f) => f.id)).toEqual(["a", "b", "c"]);
    expect(result.ranked.map((f) => f.rank)).toEqual([1, 2, 3]);
    expect(result.best?.id).toBe("a");
    expect(result.rationale).toContain("Risky bet");
    // EV annotation still uses the single shared formula
    expect(result.ranked[1].expectedValue).toBe(
      expectedValueOf({ id: "b", name: "b", score: 0.75, risk: 0.2, confidence: 0.85 })
    );
    // Edge is honest: the given best has lower EV than the alternatives' mean
    expect(result.edge).toBeLessThan(0);
  });

  it("computes EV deterministically", () => {
    expect(expectedValueOf({ id: "1", name: "n", score: 0.8, risk: 0.25, confidence: 0.5 })).toBe(
      0.3
    );
  });
});
