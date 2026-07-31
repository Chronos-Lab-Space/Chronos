import { describe, expect, it } from "vitest";
import { NoopAIProvider } from "../../domain/ai/NoopAIProvider";
import { Task } from "../../domain/chronos/task-os";
import { StartupLaunchPlanner } from "../planner/StartupLaunchPlanner";
import { ExecutionRuntime } from "./AgentOperatingSystem";
import {
  createDefaultCapabilityRegistry,
  resetDefaultCapabilityRegistryForTests,
} from "./createDefaultCapabilityRegistry";

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
    // Registered but unimplemented. Mark it the way every other stub is marked,
    // so a caller cannot mistake an empty roadmap for a computed one.
    expect(road.output.source).toBe("stub");
  });

  it("reset clears the process singleton", () => {
    resetDefaultCapabilityRegistryForTests();
    expect(() => resetDefaultCapabilityRegistryForTests()).not.toThrow();
  });

  it("resolves every capability the launch planner asks for", async () => {
    // The graph is a planning artifact — Product.tsx renders it and nothing
    // executes it. What still matters is that each kind the planner emits has
    // a registered provider, so the decomposition never names a capability
    // that does not exist.
    const graph = new StartupLaunchPlanner().decompose({
      workspaceId: "ws-launch",
      decisionId: "dec-1",
      prompt: "AI code review for mid-market teams",
    });
    const registry = createDefaultCapabilityRegistry({ ai: new NoopAIProvider() });

    for (const task of graph.tasks) {
      expect(registry.resolve(task), `no capability for ${task.kind}`).not.toBeNull();
    }
  });
});
