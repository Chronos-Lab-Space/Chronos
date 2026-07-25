import { describe, expect, it } from "vitest";
import { ChronosPlanner } from "./planner";

describe("ChronosPlanner learned preferences", () => {
  it("embeds preferences into the plan task prompt context", async () => {
    const graph = await new ChronosPlanner().createPlan({
      goal: "Launch MVP",
      workspace: { id: "w1" },
      decisionId: "d1",
      context: {
        learnedPreferences: ["Prefer lean launch over raise"],
        simulationId: "s1",
      },
    });

    const research = graph.tasks.find((t) => t.id === "research-competitors");
    expect(research).toBeTruthy();
    expect(String(research?.input.prompt)).toContain("Prefer lean launch over raise");
    expect(research?.input.learnedPreferences).toEqual(["Prefer lean launch over raise"]);
  });
});
