import type { SimulationRecord } from "./types";

/**
 * How often each knowledge source has actually been used.
 *
 * Reads `result.knowledge_used` directly rather than through
 * `resolveKnowledgeUsed`, whose library-snapshot fallback would report every
 * source as cited by every legacy run. A run that never recorded what it read
 * contributes nothing, so a low count means "not used", never "not recorded".
 */
export function countCitations(
  simulations: readonly SimulationRecord[]
): ReadonlyMap<string, number> {
  const counts = new Map<string, number>();

  for (const simulation of simulations) {
    if (simulation.status !== "completed") continue;

    const raw = simulation.result.knowledge_used;
    if (!Array.isArray(raw)) continue;

    // Per run, not per mention: one run citing a source twice is still one run.
    const idsThisRun = new Set<string>();
    for (const entry of raw) {
      if (!entry || typeof entry !== "object") continue;
      const id = (entry as Record<string, unknown>).id;
      if (typeof id === "string" && id) idsThisRun.add(id);
    }

    for (const id of idsThisRun) {
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
  }

  return counts;
}
