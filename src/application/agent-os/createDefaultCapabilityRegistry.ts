/**
 * Build the Agent OS capability registry from specialist agents.
 *
 * Pure application: pass an AIPort (or omit for noop agent singletons).
 * Env-driven AI and the process singleton live in `composition/agentOs.ts`.
 *
 * Product simulation scoring still lives in SimulationEngine — this registry
 * is the task-oriented entry for planner/runtime graphs.
 */

import {
  evaluationAgent,
  ExecutionAgent,
  executionAgent,
  memoryAgent,
  researchAgent,
  ResearchAgent,
  simulationAgent,
  taskToAgentTask,
} from "../../agents";
import type { AIPort } from "../../domain/ai/AIPort";
import { CapabilityRegistration, type Task, type TaskKind } from "../../domain/chronos/task-os";
import { CapabilityRegistry, type TaskHandler } from "./AgentOperatingSystem";

export type DefaultCapabilityRegistryOptions = {
  /** Injected AI for research/plan (tests / composition roots). When omitted, uses the noop agent singletons. */
  ai?: AIPort;
};

function handlerFromAgent(agent: {
  name?: string;
  execute: (
    task: ReturnType<typeof taskToAgentTask>
  ) => Promise<{ ok: boolean; data: Record<string, unknown>; error?: string }>;
}): TaskHandler {
  return async (task: Task) => {
    const result = await agent.execute(taskToAgentTask(task));
    if (!result.ok) {
      throw new Error(result.error ?? `${agent.name ?? "agent"} task failed`);
    }
    return result.data;
  };
}

function registration(input: {
  id: string;
  providerId: string;
  name: string;
  taskKinds: readonly TaskKind[];
  description: string;
}): CapabilityRegistration {
  return new CapabilityRegistration({
    id: input.id,
    providerId: input.providerId,
    name: input.name,
    version: "1.0.0",
    taskKinds: input.taskKinds,
    // Empty keys ⇒ any task.capability string for those kinds is accepted.
    capabilityKeys: [],
    description: input.description,
  });
}

/**
 * Build a registry with product specialist agents as concrete providers.
 * Call once at composition roots; tests should build fresh instances.
 */
export function createDefaultCapabilityRegistry(
  options: DefaultCapabilityRegistryOptions = {}
): CapabilityRegistry {
  const registry = new CapabilityRegistry();
  const research = options.ai ? new ResearchAgent(options.ai) : researchAgent;
  const execution = options.ai ? new ExecutionAgent(options.ai) : executionAgent;

  registry.register(
    registration({
      id: "cap-research",
      providerId: "chronos-research",
      name: "Research",
      taskKinds: ["research.competitors"],
      description:
        "Competitor/context research. Uses AIPort when configured; otherwise a structured stub (source: stub).",
    }),
    handlerFromAgent(research)
  );

  registry.register(
    registration({
      id: "cap-simulation",
      providerId: "chronos-simulation",
      name: "Simulation",
      taskKinds: [
        "simulation.execute",
        "financial.simulate",
        "scenario.generate",
        "branch.generate",
        "market.estimate",
        "adoption.predict",
        "risk.analyze",
      ],
      description:
        "Deterministic SimulationEngine (optional AI prose enrich only). Not an LLM decision model.",
    }),
    handlerFromAgent(simulationAgent)
  );

  registry.register(
    registration({
      id: "cap-evaluation",
      providerId: "chronos-evaluation",
      name: "Evaluation",
      taskKinds: ["outcome.evaluate", "timeline.rank"],
      description: "Ranks futures by expected value; pure deterministic scoring.",
    }),
    handlerFromAgent(evaluationAgent)
  );

  registry.register(
    registration({
      id: "cap-memory",
      providerId: "chronos-memory",
      name: "Memory",
      taskKinds: ["memory.write"],
      description: "Persists product learning records for a workspace.",
    }),
    handlerFromAgent(memoryAgent)
  );

  registry.register(
    registration({
      id: "cap-plan",
      providerId: "chronos-plan",
      name: "Plan / execution",
      taskKinds: ["plan"],
      description:
        "Turns a chosen objective into execution steps. Uses AIPort when configured; otherwise a structured stub (source: stub).",
    }),
    handlerFromAgent(execution)
  );

  return registry;
}
