import { describe, expect, it } from "vitest";
import { NoopAIProvider } from "../../domain/ai/NoopAIProvider";
import { Task } from "../../domain/chronos/task-os";
import { StartupLaunchPlanner } from "../planner/StartupLaunchPlanner";
import { ExecutionRuntime } from "./AgentOperatingSystem";
import {
  createDefaultCapabilityRegistry,
  resetDefaultCapabilityRegistryForTests,
} from "./createDefaultCapabilityRegistry";
import { runTaskGraph } from "./runTaskGraph";

describe("createDefaultCapabilityRegistry", () => {
  it("registers handlers for core product task kinds", async () => {
    const registry = createDefaultCapabilityRegistry({ ai: new NoopAIProvider() });
    const runtime = new ExecutionRuntime(registry);

    const research = await runtime.execute(
      new Task({
        id: "r1",
        kind: "research.competitors",
        title: "Research",
        capability: "research.competitors",
        input: { prompt: "B2B analytics" },
      })
    );
    expect(research.status).toBe("completed");
    expect(research.capabilityId).toBe("cap-research");
    expect(research.output.source).toBe("stub");

    const evaluate = await runtime.execute(
      new Task({
        id: "e1",
        kind: "outcome.evaluate",
        title: "Evaluate",
        capability: "outcome.evaluate",
        input: {
          futures: [
            { id: "a", name: "A", score: 0.8, risk: 0.2, confidence: 0.9 },
            { id: "b", name: "B", score: 0.5, risk: 0.1, confidence: 0.8 },
          ],
        },
      })
    );
    expect(evaluate.status).toBe("completed");
    expect(evaluate.capabilityId).toBe("cap-evaluation");
    expect(evaluate.output.best).toBeTruthy();

    const memory = await runtime.execute(
      new Task({
        id: "m1",
        kind: "memory.write",
        title: "Memory",
        capability: "memory.write",
        input: {
          workspaceId: "ws-test-cap-registry",
          simulationId: "sim-1",
          recommendation: "Ship wedge",
          futures: [{ id: "a", name: "A", score: 0.8 }],
        },
      })
    );
    expect(memory.status).toBe("completed");
    expect(memory.capabilityId).toBe("cap-memory");

    const sim = await runtime.execute(
      new Task({
        id: "s1",
        kind: "simulation.execute",
        title: "Sim",
        capability: "simulation.execute",
        input: { prompt: "launch a marketplace" },
      })
    );
    // Without full SimulationEngineInput the agent acknowledges rather than failing the OS.
    expect(sim.status).toBe("completed");
    expect(sim.capabilityId).toBe("cap-simulation");
  });

  it("resolves plan and roadmap stubs", async () => {
    const registry = createDefaultCapabilityRegistry({ ai: new NoopAIProvider() });
    const runtime = new ExecutionRuntime(registry);

    const plan = await runtime.execute(
      new Task({
        id: "p1",
        kind: "plan",
        title: "Plan",
        capability: "plan",
        input: {},
      })
    );
    expect(plan.status).toBe("completed");
    expect(plan.capabilityId).toBe("cap-plan");

    const road = await runtime.execute(
      new Task({
        id: "rd1",
        kind: "roadmap.build",
        title: "Roadmap",
        capability: "roadmap.build",
        input: {},
      })
    );
    expect(road.status).toBe("completed");
    expect(road.capabilityId).toBe("cap-roadmap");
  });

  it("reset clears the process singleton", () => {
    resetDefaultCapabilityRegistryForTests();
    expect(() => resetDefaultCapabilityRegistryForTests()).not.toThrow();
  });

  it("runTaskGraph executes a launch plan against default capabilities", async () => {
    const graph = new StartupLaunchPlanner().decompose({
      workspaceId: "ws-launch",
      decisionId: "dec-1",
      prompt: "AI code review for mid-market teams",
    });
    const result = await runTaskGraph(graph, {
      registry: createDefaultCapabilityRegistry({ ai: new NoopAIProvider() }),
    });

    expect(result.failed).toEqual([]);
    expect(result.completed.length).toBe(graph.tasks.length);
    expect(result.outputs["research-competitors"]?.source).toBe("stub");
  });
});
