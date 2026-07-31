import { describe, expect, it } from "vitest";
import { StartupLaunchPlanner } from "./StartupLaunchPlanner";

describe("StartupLaunchPlanner", () => {
  it("decomposes launch startup into a dependency-aware task graph", () => {
    const graph = new StartupLaunchPlanner().decompose({
      workspaceId: "workspace-01",
      decisionId: "launch-startup",
      prompt: "Launch a vertical AI startup",
    });

    // Every step names a capability with a real handler behind it. "Build
    // roadmap" used to sit third and was the one exception — nothing
    // implemented roadmap.build anywhere, so the plan advertised a step
    // Chronos could not take.
    expect(graph.tasks.map((task) => task.title)).toEqual([
      "Research competitors",
      "Estimate market",
      "Predict adoption",
      "Financial simulation",
      "Risk analysis",
    ]);
    expect(graph.readyTasks(new Set()).map((task) => task.id)).toEqual(["research-competitors"]);
    expect(
      graph.readyTasks(new Set(["research-competitors", "estimate-market"])).map((task) => task.id)
    ).toEqual(["predict-adoption"]);
  });
});
