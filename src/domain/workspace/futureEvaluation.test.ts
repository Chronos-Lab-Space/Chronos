import { describe, expect, it } from "vitest";
import { evaluateFutures, expectedValueOf } from "./futureEvaluation";

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

  it("computes EV deterministically", () => {
    expect(expectedValueOf({ id: "1", name: "n", score: 0.8, risk: 0.25, confidence: 0.5 })).toBe(
      0.3
    );
  });
});
