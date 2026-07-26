import { describe, expect, it } from "vitest";
import { CapabilityRegistration, Task } from "../../domain/chronos/task-os";
import {
  CapabilityRegistry,
  ExecutionRuntime,
  Planner,
  RankingEngine,
  Scheduler,
} from "./AgentOperatingSystem";

describe("Agent Operating System", () => {
  it("plans and schedules dependency-ready tasks without knowing individual agents", () => {
    const graph = new Planner().createGraph({
      id: "graph-01",
      workspaceId: "workspace-01",
      decisionId: "decision-01",
      tasks: [
        new Task({
          id: "plan",
          kind: "plan",
          title: "Plan",
          capability: "planner",
          input: {},
          priority: 3,
        }),
        new Task({
          id: "simulate",
          kind: "simulation.execute",
          title: "Simulate",
          capability: "sim",
          input: {},
          dependencies: ["plan"],
          priority: 2,
        }),
        new Task({
          id: "rank",
          kind: "timeline.rank",
          title: "Rank",
          capability: "rank",
          input: {},
          dependencies: ["simulate"],
          priority: 1,
        }),
      ],
    });
    const scheduler = new Scheduler();

    expect(scheduler.next(graph, new Set()).map((task) => task.id)).toEqual(["plan"]);
    expect(scheduler.next(graph, new Set(["plan"])).map((task) => task.id)).toEqual(["simulate"]);
    expect(scheduler.next(graph, new Set(["plan", "simulate"])).map((task) => task.id)).toEqual([
      "rank",
    ]);
  });

  it("routes a task to a registered capability and ranks evaluated timelines", async () => {
    const registry = new CapabilityRegistry();
    registry.register(
      new CapabilityRegistration({
        id: "sim-capability",
        providerId: "provider-42",
        name: "Simulation runtime",
        version: "1.0.0",
        taskKinds: ["simulation.execute"],
        description: "Executes a simulation task.",
      }),
      async () => ({ score: 0.92, confidence: 0.88 })
    );

    const execution = await new ExecutionRuntime(registry).execute(
      new Task({
        id: "task-01",
        kind: "simulation.execute",
        title: "Run",
        capability: "sim",
        input: {},
      })
    );

    expect(execution.status).toBe("completed");
    expect(execution.capabilityId).toBe("sim-capability");
    expect(
      new RankingEngine().rank([
        { timelineId: "timeline-b", score: 0.4, evaluationIds: [] },
        { timelineId: "timeline-a", score: 0.92, evaluationIds: [execution.id] },
      ])
    ).toEqual([
      { timelineId: "timeline-a", score: 0.92, rank: 1, evaluationIds: [execution.id] },
      { timelineId: "timeline-b", score: 0.4, rank: 2, evaluationIds: [] },
    ]);
  });
});
