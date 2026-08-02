/**
 * Execution plan for a path the user has already committed to.
 *
 * Runs after collapse, never before: the decision is made, so this asks
 * "what does doing it look like?" rather than re-opening the choice. Same
 * shape as SimulationEngine.maybeEnrichRecommendation — best-effort prose
 * layered on top of a deterministic result, failing open to nothing.
 *
 * Returns no steps rather than invented ones when no provider is configured.
 * See SPEC-llm-capability.md.
 */

import { Task } from "../../domain/chronos/task-os";
import { type CapabilityRegistry, ExecutionRuntime } from "./AgentOperatingSystem";

export type ChosenPath = {
  objective: string;
  pathName: string;
  pathSummary: string;
  /** Optional research note body — multi-cap chain: research → plan. */
  researchContext?: string;
};

export type PlanResult = {
  steps: string[];
  /** "ai" only when a provider actually produced the steps. */
  source: "ai" | "stub";
};

const EMPTY: PlanResult = { steps: [], source: "stub" };

export async function planChosenPath(
  registry: CapabilityRegistry,
  chosen: ChosenPath
): Promise<PlanResult> {
  const objective = chosen.objective.trim();
  if (!objective) return EMPTY;

  try {
    const runtime = new ExecutionRuntime(registry);
    const execution = await runtime.execute(
      new Task({
        id: `plan-${chosen.pathName.slice(0, 40)}`,
        kind: "plan",
        title: "Execution plan",
        capability: "plan",
        input: {
          // The committed path is the subject — the objective alone would plan
          // the decision again instead of its outcome.
          objective: [
            `Decision: ${objective}`,
            `Chosen path: ${chosen.pathName}`,
            chosen.pathSummary ? `Path summary: ${chosen.pathSummary}` : null,
          ]
            .filter(Boolean)
            .join("\n"),
          // Multi-cap: research findings feed plan context without re-ranking.
          ...(chosen.researchContext?.trim()
            ? { researchContext: chosen.researchContext.trim() }
            : {}),
        },
      })
    );

    if (execution.status !== "completed") return EMPTY;

    const steps = Array.isArray(execution.output.steps)
      ? execution.output.steps.filter((s): s is string => typeof s === "string" && s.length > 0)
      : [];
    if (steps.length === 0) return EMPTY;

    return { steps, source: execution.output.source === "ai" ? "ai" : "stub" };
  } catch (err) {
    // A plan is a bonus on top of a saved decision; it must never unmake one.
    console.warn("[chronos] execution plan failed; decision stands without steps.", err);
    return EMPTY;
  }
}
