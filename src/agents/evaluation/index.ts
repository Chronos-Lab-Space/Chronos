import {
  evaluateFutures,
  type EvaluableFuture,
  type FutureEvaluationResult,
} from "../../domain/workspace/futureEvaluation";
import type { Agent, AgentResult, AgentTask } from "../types";

function asFutures(input: Record<string, unknown>): EvaluableFuture[] {
  const raw = input.futures;
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const f = item as Record<string, unknown>;
      if (typeof f.id !== "string" || typeof f.name !== "string") return null;
      if (typeof f.score !== "number") return null;
      return {
        id: f.id,
        name: f.name,
        score: f.score,
        risk: typeof f.risk === "number" ? f.risk : undefined,
        confidence: typeof f.confidence === "number" ? f.confidence : undefined,
        summary: typeof f.summary === "string" ? f.summary : undefined,
      } satisfies EvaluableFuture;
    })
    .filter((f): f is EvaluableFuture => f !== null);
}

/**
 * Real evaluation agent: ranks product futures by expected value.
 * Capabilities: outcome.evaluate | evaluation | timeline.rank
 */
export class EvaluationAgent implements Agent {
  readonly name = "evaluation";
  readonly capabilities = ["outcome.evaluate", "evaluation", "timeline.rank"] as const;

  async execute(task: AgentTask): Promise<AgentResult> {
    const futures = asFutures(task.input);

    // Single pre-scored payload (legacy / simple call sites)
    if (futures.length === 0 && typeof task.input.score === "number") {
      const score = Math.max(0, Math.min(1, task.input.score));
      const confidence =
        typeof task.input.confidence === "number"
          ? Math.max(0, Math.min(1, task.input.confidence))
          : 0.5;
      return {
        ok: true,
        capability: task.capability,
        agent: this.name,
        data: {
          score,
          confidence,
          rationale: String(task.input.rationale ?? "Single-score evaluation"),
          policyCompliant: task.input.policyCompliant !== false,
          ranked: [],
          best: null,
          edge: 0,
        },
      };
    }

    const hardRiskCeiling =
      typeof task.input.hardRiskCeiling === "number" ? task.input.hardRiskCeiling : undefined;

    const result: FutureEvaluationResult = evaluateFutures(futures, { hardRiskCeiling });

    return {
      ok: true,
      capability: task.capability,
      agent: this.name,
      data: {
        score: result.best?.expectedValue ?? 0,
        confidence: result.aggregateConfidence,
        rationale: result.rationale,
        policyCompliant: result.policyCompliant,
        edge: result.edge,
        best: result.best,
        ranked: result.ranked,
        evaluation: result as unknown as Record<string, unknown>,
      },
    };
  }
}

export const evaluationAgent = new EvaluationAgent();
