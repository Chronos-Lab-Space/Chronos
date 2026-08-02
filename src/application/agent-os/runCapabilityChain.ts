/**
 * Multi-capability prose chain — one handler's output can feed the next.
 *
 * Never used on the ranking path. Only for task kinds that produce labeled
 * prose (research → plan context). Engine scores stay untouched.
 *
 * See SPEC-llm-capability.md later slices.
 */

import { Task, type TaskKind } from "../../domain/chronos/task-os";
import { type CapabilityRegistry, ExecutionRuntime } from "./AgentOperatingSystem";

export type ChainStep = {
  id: string;
  kind: TaskKind;
  capability: string;
  title: string;
  /** Build input for this step from prior outputs (keyed by step id). */
  input: (prior: Record<string, Record<string, unknown>>) => Record<string, unknown>;
};

export type ChainStepResult = {
  stepId: string;
  kind: TaskKind;
  status: "completed" | "failed";
  output: Record<string, unknown>;
  error?: string;
};

export type ChainResult = {
  steps: ChainStepResult[];
  /** Last completed step's output, if any. */
  final: Record<string, unknown> | null;
  ok: boolean;
};

/**
 * Run steps in order. A failed step stops the chain (fail-closed for the
 * chain, fail-open for the product — callers decide).
 */
export async function runCapabilityChain(
  registry: CapabilityRegistry,
  steps: readonly ChainStep[]
): Promise<ChainResult> {
  const runtime = new ExecutionRuntime(registry);
  const prior: Record<string, Record<string, unknown>> = {};
  const results: ChainStepResult[] = [];

  for (const step of steps) {
    try {
      const input = step.input(prior);
      const execution = await runtime.execute(
        new Task({
          id: step.id,
          kind: step.kind,
          title: step.title,
          capability: step.capability,
          input,
        })
      );

      if (execution.status !== "completed") {
        results.push({
          stepId: step.id,
          kind: step.kind,
          status: "failed",
          output: {},
          error: execution.error ?? "step failed",
        });
        return { steps: results, final: null, ok: false };
      }

      prior[step.id] = execution.output;
      results.push({
        stepId: step.id,
        kind: step.kind,
        status: "completed",
        output: execution.output,
      });
    } catch (err) {
      results.push({
        stepId: step.id,
        kind: step.kind,
        status: "failed",
        output: {},
        error: err instanceof Error ? err.message : String(err),
      });
      return { steps: results, final: null, ok: false };
    }
  }

  const last = results[results.length - 1];
  return {
    steps: results,
    final: last?.status === "completed" ? last.output : null,
    ok: results.length > 0 && results.every((r) => r.status === "completed"),
  };
}
