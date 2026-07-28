/**
 * Execute a TaskGraph through the Agent OS: schedule → resolve capability → evaluate.
 * Product sims still score via SimulationEngine; this is the task-oriented path
 * (planner graphs, future multi-capability runs).
 */

import type { TaskGraph } from "../../domain/chronos/task-os";
import {
  type CapabilityRegistry,
  ExecutionRuntime,
  OutcomeEvaluator,
  Scheduler,
} from "./AgentOperatingSystem";
import { createDefaultCapabilityRegistry } from "./createDefaultCapabilityRegistry";

export type TaskGraphRunResult = {
  graphId: string;
  completed: string[];
  failed: string[];
  outputs: Record<string, Record<string, unknown>>;
  errors: Record<string, string>;
  evaluations: Record<string, { score: number; confidence: number; rationale: string }>;
};

export type RunTaskGraphOptions = {
  registry?: CapabilityRegistry;
  concurrency?: number;
  /** Max scheduling rounds (safety for incomplete graphs). */
  maxRounds?: number;
};

/**
 * Run all dependency-ready tasks until the graph is complete or stuck.
 * Failures do not halt siblings; dependents of failed tasks stay unscheduled.
 */
export async function runTaskGraph(
  graph: TaskGraph,
  options: RunTaskGraphOptions = {}
): Promise<TaskGraphRunResult> {
  const registry = options.registry ?? createDefaultCapabilityRegistry();
  const scheduler = new Scheduler();
  const runtime = new ExecutionRuntime(registry);
  const evaluator = new OutcomeEvaluator();
  const concurrency = options.concurrency ?? 2;
  const maxRounds = options.maxRounds ?? graph.tasks.length + 4;

  const completed = new Set<string>();
  const failed = new Set<string>();
  const outputs: Record<string, Record<string, unknown>> = {};
  const errors: Record<string, string> = {};
  const evaluations: TaskGraphRunResult["evaluations"] = {};

  for (let round = 0; round < maxRounds; round += 1) {
    const ready = scheduler.next(graph, completed, concurrency).filter((t) => !failed.has(t.id));
    if (ready.length === 0) break;

    await Promise.all(
      ready.map(async (task) => {
        const execution = await runtime.execute(task);
        if (execution.status === "completed") {
          completed.add(task.id);
          outputs[task.id] = { ...execution.output };
          const evaluation = evaluator.evaluate(execution);
          evaluations[task.id] = {
            score: evaluation.score,
            confidence: evaluation.confidence,
            rationale: evaluation.rationale,
          };
        } else {
          failed.add(task.id);
          errors[task.id] = execution.error ?? "execution failed";
        }
      })
    );
  }

  return {
    graphId: graph.id,
    completed: [...completed],
    failed: [...failed],
    outputs,
    errors,
    evaluations,
  };
}
