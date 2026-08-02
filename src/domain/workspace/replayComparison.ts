/**
 * Deeper replay — compare two versions of the same decision after a re-run
 * with different knowledge. Pure report; never changes ranking.
 */

import type { FutureRecord, SimulationRecord } from "./types";

export type ReplayComparison = {
  beforeId: string;
  afterId: string;
  beforeBest: string | null;
  afterBest: string | null;
  /** True when the recommended path name changed. */
  recommendationChanged: boolean;
  beforeConfidence: number | null;
  afterConfidence: number | null;
  confidenceDelta: number | null;
  /** Top-3 names before vs after for a short UI list. */
  beforeTop: readonly string[];
  afterTop: readonly string[];
  summary: string;
};

function bestName(sim: SimulationRecord, futures: readonly FutureRecord[]): string | null {
  const chosen = sim.result.chosen_future_id;
  if (typeof chosen === "string") {
    const f = futures.find((x) => x.id === chosen);
    if (f) return f.name;
  }
  const named = sim.result.best_future;
  if (typeof named === "string" && named.trim()) return named.trim();
  return futures[0]?.name ?? null;
}

function topNames(futures: readonly FutureRecord[], n = 3): string[] {
  return futures.slice(0, n).map((f) => f.name);
}

/**
 * Compare a parent simulation to a re-run (child). Expects futures ordered
 * by engine rank (best first), as stored in WorkspaceHome.
 */
export function deriveReplayComparison(
  before: SimulationRecord,
  after: SimulationRecord,
  beforeFutures: readonly FutureRecord[],
  afterFutures: readonly FutureRecord[]
): ReplayComparison {
  const beforeBest = bestName(before, beforeFutures);
  const afterBest = bestName(after, afterFutures);
  const beforeConfidence = typeof before.confidence === "number" ? before.confidence : null;
  const afterConfidence = typeof after.confidence === "number" ? after.confidence : null;
  const confidenceDelta =
    beforeConfidence != null && afterConfidence != null ? afterConfidence - beforeConfidence : null;
  const recommendationChanged = beforeBest != null && afterBest != null && beforeBest !== afterBest;

  let summary: string;
  if (recommendationChanged) {
    summary = `Recommendation moved from “${beforeBest}” to “${afterBest}”.`;
  } else if (beforeBest && afterBest) {
    summary = `Recommendation stayed “${afterBest}”.`;
  } else {
    summary = "Could not compare recommendations — missing path names.";
  }
  if (confidenceDelta != null && Math.abs(confidenceDelta) >= 0.01) {
    const pts = Math.round(confidenceDelta * 100);
    summary += ` Confidence ${pts > 0 ? "+" : ""}${pts} pts.`;
  }

  return {
    beforeId: before.id,
    afterId: after.id,
    beforeBest,
    afterBest,
    recommendationChanged,
    beforeConfidence,
    afterConfidence,
    confidenceDelta,
    beforeTop: topNames(beforeFutures),
    afterTop: topNames(afterFutures),
    summary,
  };
}
