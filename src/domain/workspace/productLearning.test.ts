import { describe, expect, it } from "vitest";
import { deriveProductLearning } from "./productLearning";

describe("deriveProductLearning", () => {
  it("creates outcome + decision + preference memories", () => {
    const snap = deriveProductLearning({
      workspaceId: "w1",
      simulationId: "s1",
      recommendation: "Ship MVP first",
      futures: [
        { id: "f1", name: "MVP", score: 0.8, rank: 1, expectedValue: 0.5 },
        { id: "f2", name: "Raise", score: 0.5, risk: 0.7, rank: 2 },
      ],
      now: "2026-01-01T00:00:00.000Z",
    });

    expect(snap.successfulFuture?.name).toBe("MVP");
    expect(snap.memories.some((m) => m.kind === "outcome")).toBe(true);
    expect(snap.memories.some((m) => m.kind === "decision")).toBe(true);
    expect(snap.memories.some((m) => m.kind === "preference")).toBe(true);
    expect(snap.preferenceHints.length).toBeGreaterThan(0);
  });
});
