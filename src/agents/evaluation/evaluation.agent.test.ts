import { describe, expect, it } from "vitest";
import { EvaluationAgent } from "./index";

describe("EvaluationAgent", () => {
  it("preserves caller order when preserveOrder is set", async () => {
    const agent = new EvaluationAgent();
    const result = await agent.execute({
      id: "t2",
      capability: "outcome.evaluate",
      input: {
        preserveOrder: true,
        futures: [
          { id: "b", name: "B", score: 0.95, risk: 0.7, confidence: 0.9 },
          { id: "a", name: "A", score: 0.6, risk: 0.1, confidence: 0.9 },
        ],
      },
    });

    expect(result.ok).toBe(true);
    // EV would put "a" first — the caller's order must win.
    expect(
      (result.data.ranked as { id: string; rank: number }[]).map((f) => [f.id, f.rank])
    ).toEqual([
      ["b", 1],
      ["a", 2],
    ]);
    expect(result.data.best).toEqual(expect.objectContaining({ id: "b" }));
  });

  it("ranks futures via outcome.evaluate", async () => {
    const agent = new EvaluationAgent();
    const result = await agent.execute({
      id: "t1",
      capability: "outcome.evaluate",
      input: {
        futures: [
          { id: "a", name: "A", score: 0.6, risk: 0.1, confidence: 0.9 },
          { id: "b", name: "B", score: 0.95, risk: 0.7, confidence: 0.9 },
        ],
      },
    });

    expect(result.ok).toBe(true);
    expect(result.data.best).toEqual(expect.objectContaining({ id: "a" }));
    expect(Array.isArray(result.data.ranked)).toBe(true);
    expect((result.data.ranked as unknown[]).length).toBe(2);
  });
});
