import type { LearningMemoryRecord } from "./productLearning";
import { stableUuidFromSeed } from "./stableUuid";
import type { OutcomeFollowed, OutcomeVerdict } from "./types";

/**
 * Outcome learning — closes the loop the product promises:
 * "Chronos re-weights the models that got it wrong."
 *
 * deriveProductLearning writes priors at *prediction* time. This module writes
 * what actually happened once the user logs it, and weights those priors so a
 * recommendation that missed stops steering the next run.
 *
 * Deliberately bounded: priors remain soft constraints, so a bad outcome can
 * demote or drop a hint but never alters scoring math.
 */

/** Relative pull a prior keeps once its run's real outcome is known. */
export const PRIOR_WEIGHT = {
  /** Outcome was worse than predicted — the prior misled; drop it. */
  missed: 0,
  /** Recommendation was not adopted — no evidence it was right. */
  notFollowed: 0.5,
  /** No outcome logged yet — unchanged from today's behavior. */
  unknown: 1,
  asExpected: 2,
  better: 3,
} as const;

export type OutcomeSignal = {
  followed?: OutcomeFollowed | null;
  verdict?: OutcomeVerdict | null;
};

/** Weight for priors originating from a run with this outcome. */
export function priorWeight(signal: OutcomeSignal | undefined | null): number {
  if (!signal) return PRIOR_WEIGHT.unknown;
  if (signal.verdict === "worse") return PRIOR_WEIGHT.missed;
  if (signal.verdict === "better") return PRIOR_WEIGHT.better;
  if (signal.verdict === "as_expected") return PRIOR_WEIGHT.asExpected;
  if (signal.followed === "no") return PRIOR_WEIGHT.notFollowed;
  return PRIOR_WEIGHT.unknown;
}

/**
 * Choose which preference hints feed the next run.
 * Priors from runs that missed are dropped; the rest rank by weight, then recency.
 */
export function selectWeightedPreferences(
  records: readonly LearningMemoryRecord[],
  outcomeBySimulationId: Readonly<Record<string, OutcomeSignal>>,
  limit = 3
): string[] {
  const scored = records
    .filter((r) => r.kind === "preference")
    .map((r) => ({
      content: r.content,
      weight: priorWeight(outcomeBySimulationId[r.simulationId]),
      createdAt: r.createdAt,
    }))
    .filter((r) => r.weight > PRIOR_WEIGHT.missed);

  scored.sort((a, b) => b.weight - a.weight || b.createdAt.localeCompare(a.createdAt));

  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of scored) {
    if (seen.has(item.content)) continue;
    seen.add(item.content);
    out.push(item.content);
    if (out.length >= limit) break;
  }
  return out;
}

function verdictSentence(verdict: OutcomeVerdict): string {
  if (verdict === "better") return "Outcome beat the prediction";
  if (verdict === "worse") return "Outcome missed the prediction";
  return "Outcome landed as predicted";
}

/**
 * Record what actually happened. Unlike the prediction-time snapshot, every
 * value here comes from the user's own report.
 */
export function deriveOutcomeLearning(input: {
  workspaceId: string;
  simulationId: string;
  followed?: OutcomeFollowed | null;
  verdict?: OutcomeVerdict | null;
  resultNote?: string | null;
  pathName?: string | null;
  now?: string;
}): LearningMemoryRecord[] {
  const createdAt = input.now ?? new Date().toISOString();
  const note = input.resultNote?.trim() ?? "";
  const path = input.pathName?.trim() || "the chosen path";
  const records: LearningMemoryRecord[] = [];

  if (input.followed) {
    const adopted =
      input.followed === "yes"
        ? `Followed the recommendation for ${path}.`
        : input.followed === "partially"
          ? `Partially followed the recommendation for ${path}.`
          : `Did not follow the recommendation for ${path}.`;
    records.push({
      id: stableUuidFromSeed(`learning:observed:${input.simulationId}`),
      workspaceId: input.workspaceId,
      simulationId: input.simulationId,
      kind: "outcome",
      content: adopted,
      metadata: {
        source: "learning",
        learningKey: `observed:${input.simulationId}`,
        observed: true,
        followed: input.followed,
      },
      createdAt,
    });
  }

  if (input.verdict || note) {
    const headline = input.verdict ? verdictSentence(input.verdict) : "Outcome logged";
    records.push({
      id: stableUuidFromSeed(`learning:result:${input.simulationId}`),
      workspaceId: input.workspaceId,
      simulationId: input.simulationId,
      kind: "outcome",
      content: note ? `${headline}: ${note.slice(0, 400)}` : `${headline}.`,
      metadata: {
        source: "learning",
        learningKey: `result:${input.simulationId}`,
        observed: true,
        verdict: input.verdict ?? null,
        priorWeight: priorWeight({ followed: input.followed, verdict: input.verdict }),
      },
      createdAt,
    });
  }

  return records;
}
