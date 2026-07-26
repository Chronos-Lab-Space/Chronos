import {
  type CapabilityRegistration,
  Evaluation,
  type Task,
  TaskExecution,
  TaskGraph,
  TimelineRanking,
  type RankedTimeline,
} from "../../domain/chronos/task-os";

export type TaskHandler = (task: Task) => Promise<Record<string, unknown>>;

/** External providers register handlers. The OS sees capabilities, not agents. */
export class CapabilityRegistry {
  private readonly registrations = new Map<string, CapabilityRegistration>();
  private readonly handlers = new Map<string, TaskHandler>();

  register(capability: CapabilityRegistration, handler: TaskHandler) {
    this.registrations.set(capability.id, capability);
    this.handlers.set(capability.id, handler);
  }

  resolve(task: Task): CapabilityRegistration | null {
    return (
      [...this.registrations.values()].find((capability) => capability.supportsTask(task)) ?? null
    );
  }

  handler(capabilityId: string): TaskHandler | null {
    return this.handlers.get(capabilityId) ?? null;
  }
}

/** Planner creates a dependency graph; it does not execute individual agents. */
export class Planner {
  createGraph(input: {
    id: string;
    workspaceId: string;
    decisionId: string;
    tasks: readonly Task[];
  }): TaskGraph {
    return new TaskGraph(input);
  }
}

/** Scheduler selects dependency-ready tasks by priority. */
export class Scheduler {
  next(graph: TaskGraph, completedTaskIds: ReadonlySet<string>, concurrency = 1): Task[] {
    return graph.readyTasks(completedTaskIds).slice(0, concurrency);
  }
}

/** Executes tasks through registered capabilities, not through named agents. */
export class ExecutionRuntime {
  private sequence = 0;

  constructor(private readonly capabilities: CapabilityRegistry) {}

  async execute(task: Task): Promise<TaskExecution> {
    this.sequence += 1;
    const capability = this.capabilities.resolve(task);

    if (!capability) {
      return new TaskExecution({
        id: `execution-${this.sequence}`,
        taskId: task.id,
        capabilityId: "unresolved",
        status: "failed",
        error: `No capability registered for task kind: ${task.kind}`,
        completedAt: new Date().toISOString(),
      });
    }

    const handler = this.capabilities.handler(capability.id);
    if (!handler) {
      return new TaskExecution({
        id: `execution-${this.sequence}`,
        taskId: task.id,
        capabilityId: capability.id,
        status: "failed",
        error: `No handler registered for capability: ${capability.id}`,
        completedAt: new Date().toISOString(),
      });
    }

    try {
      const output = await handler(task);
      return new TaskExecution({
        id: `execution-${this.sequence}`,
        taskId: task.id,
        capabilityId: capability.id,
        status: "completed",
        output,
        completedAt: new Date().toISOString(),
      });
    } catch (error) {
      return new TaskExecution({
        id: `execution-${this.sequence}`,
        taskId: task.id,
        capabilityId: capability.id,
        status: "failed",
        error: (error as Error).message,
        completedAt: new Date().toISOString(),
      });
    }
  }
}

export class OutcomeEvaluator {
  evaluate(execution: TaskExecution): Evaluation {
    const rawScore = typeof execution.output.score === "number" ? execution.output.score : 0;
    const confidence =
      typeof execution.output.confidence === "number" ? execution.output.confidence : 0.5;
    return new Evaluation({
      id: `evaluation-${execution.id}`,
      executionId: execution.id,
      score: rawScore,
      confidence,
      rationale: execution.error ?? "Task completed and evaluated.",
      policyCompliant: execution.status === "completed",
    });
  }
}

export class RankingEngine {
  rank(entries: readonly Omit<RankedTimeline, "rank">[]) {
    return TimelineRanking.rank(entries);
  }
}
