import { describe, expect, it } from "vitest";
import { Scheduler } from "../agent-os/AgentOperatingSystem";
import { StartupLaunchPlanner } from "./StartupLaunchPlanner";

describe("StartupLaunchPlanner", () => {
  it("decomposes launch startup into a dependency-aware task graph", () => {
    const graph = new StartupLaunchPlanner().decompose({
      workspaceId: "workspace-01",
      decisionId: "launch-startup",
      prompt: "Launch a vertical AI startup",
    });

    expect(graph.tasks.map((task) => task.title)).toEqual([
      "Research competitors",
      "Estimate market",
      "Build roadmap",
      "Predict adoption",
      "Financial simulation",
      "Risk analysis",
    ]);
    expect(new Scheduler().next(graph, new Set()).map((task) => task.id)).toEqual([
      "research-competitors",
    ]);
    expect(
      new Scheduler()
        .next(graph, new Set(["research-competitors", "estimate-market"]))
        .map((task) => task.id)
    ).toEqual(["build-roadmap"]);
  });
});
