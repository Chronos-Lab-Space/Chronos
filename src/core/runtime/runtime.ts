import type { Agent, AgentResult, AgentTask } from "../../agents/types";
import { supportsCapability, taskToAgentTask } from "../../agents/types";
import type { TaskGraph } from "../../domain/chronos/task-os";
import { type EventBus, eventBus } from "./events";

export type RuntimeOptions = {
  retries?: number;
  timeoutMs?: number;
  concurrency?: number;
  bus?: EventBus;
};

export type GraphRunResult = {
  graphId: string;
  results: Record<string, AgentResult>;
  completed: string[];
  failed: string[];
};

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  if (!timeoutMs || timeoutMs <= 0) return promise;
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timeout after ${timeoutMs}ms: ${label}`));
    }, timeoutMs);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

/**
 * Agent Runtime: register agents by capability, schedule task graphs,
 * apply retries/timeouts, resolve dependencies.
 */
export class AgentRuntime {
  private readonly agents: Agent[] = [];
  private readonly byCapability = new Map<string, Agent>();
  private readonly bus: EventBus;

  constructor(private readonly defaults: RuntimeOptions = {}) {
    this.bus = defaults.bus ?? eventBus;
  }

  register(agent: Agent): this {
    this.agents.push(agent);
    for (const capability of agent.capabilities) {
      this.byCapability.set(capability, agent);
    }
    return this;
  }

  listAgents(): readonly Agent[] {
    return this.agents;
  }

  resolve(capability: string): Agent | null {
    return this.byCapability.get(capability) ?? null;
  }

  /** Run a single capability (e.g. runtime.run("generate_code")). */
  async run(
    capability: string,
    input: Record<string, unknown> = {},
    options?: RuntimeOptions
  ): Promise<AgentResult> {
    const task: AgentTask = {
      id: `task-${capability}-${Date.now()}`,
      capability,
      input,
    };
    return this.executeTask(task, options);
  }

  async executeTask(task: AgentTask, options?: RuntimeOptions): Promise<AgentResult> {
    const retries = options?.retries ?? this.defaults.retries ?? 0;
    const timeoutMs = options?.timeoutMs ?? this.defaults.timeoutMs ?? 0;
    const agent = this.resolve(task.capability);

    if (!agent) {
      const failed: AgentResult = {
        ok: false,
        capability: task.capability,
        agent: "unresolved",
        data: {},
        error: `No agent registered for capability: ${task.capability}`,
      };
      await this.bus.publish("TaskFailed", {
        taskId: task.id,
        capability: task.capability,
        error: failed.error,
      });
      return failed;
    }

    await this.bus.publish("TaskStarted", {
      taskId: task.id,
      capability: task.capability,
      agent: agent.name,
    });

    let lastError: string | undefined;
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const result = await withTimeout(
          agent.execute(task),
          timeoutMs,
          `${agent.name}:${task.capability}`
        );
        if (result.ok) {
          await this.bus.publish("TaskCompleted", {
            taskId: task.id,
            capability: task.capability,
            agent: agent.name,
            data: result.data,
          });
          return result;
        }
        lastError = result.error ?? "Agent returned ok=false";
      } catch (error) {
        lastError = (error as Error).message;
      }
    }

    const failed: AgentResult = {
      ok: false,
      capability: task.capability,
      agent: agent.name,
      data: {},
      error: lastError ?? "Unknown failure",
    };
    await this.bus.publish("TaskFailed", {
      taskId: task.id,
      capability: task.capability,
      agent: agent.name,
      error: failed.error,
    });
    return failed;
  }

  /**
   * Execute a planner task graph with dependency resolution and optional parallelism.
   */
  async runGraph(graph: TaskGraph, options?: RuntimeOptions): Promise<GraphRunResult> {
    const concurrency = Math.max(1, options?.concurrency ?? this.defaults.concurrency ?? 1);
    const completed = new Set<string>();
    const failed: string[] = [];
    const results: Record<string, AgentResult> = {};

    const pending = new Map(graph.tasks.map((task) => [task.id, task]));

    while (pending.size > 0) {
      const ready = [...pending.values()]
        .filter((task) => task.dependencies.every((dep) => completed.has(dep)))
        .filter((task) => !task.dependencies.some((dep) => failed.includes(dep)))
        .sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id));

      if (ready.length === 0) {
        // Remaining tasks blocked by failures
        for (const task of pending.values()) {
          failed.push(task.id);
          results[task.id] = {
            ok: false,
            capability: task.capability,
            agent: "skipped",
            data: {},
            error: "Blocked by failed dependency",
          };
        }
        break;
      }

      const batch = ready.slice(0, concurrency);
      const batchResults = await Promise.all(
        batch.map(async (task) => {
          pending.delete(task.id);
          const result = await this.executeTask(taskToAgentTask(task), options);
          return { task, result };
        })
      );

      for (const { task, result } of batchResults) {
        results[task.id] = result;
        if (result.ok) {
          completed.add(task.id);
        } else {
          failed.push(task.id);
        }
      }
    }

    await this.bus.publish("GraphCompleted", {
      graphId: graph.id,
      completed: [...completed],
      failed,
    });

    return {
      graphId: graph.id,
      results,
      completed: [...completed],
      failed,
    };
  }

  /** Discover agents that claim a capability (registration order). */
  discover(capability: string): Agent[] {
    return this.agents.filter((agent) => supportsCapability(agent, capability));
  }
}

export function createDefaultRuntime(options?: RuntimeOptions): AgentRuntime {
  // Lazy import defaults to avoid circular init issues at module load time.
  // Callers may also register manually.
  return new AgentRuntime(options);
}

export const runtime = new AgentRuntime();
