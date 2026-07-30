/**
 * Deterministic learning artifacts from product decision rankings.
 * Storage is an adapter concern — this module only derives records.
 */

import { stableUuidFromSeed } from "./stableUuid";

export type RankedFutureSignal = {
  id: string;
  name: string;
  score: number;
  risk?: number;
  expectedValue?: number;
  rank?: number;
};

export type LearningMemoryRecord = {
  /** UUID — stable for local + Supabase dual-write. */
  id: string;
  workspaceId: string;
  simulationId: string;
  kind: "outcome" | "preference" | "decision";
  content: string;
  metadata: Record<string, unknown>;
  createdAt: string;
};

/**
 * Where learning records are kept. The rules for *what* to remember are
 * domain logic; localStorage, Supabase, or nothing at all is a deployment
 * choice, so services take this port instead of naming a store.
 */
export type LearningMemoryPort = {
  list(workspaceId: string): readonly LearningMemoryRecord[];
  append(workspaceId: string, records: readonly LearningMemoryRecord[]): number;
};

/** Discards everything. The default when no store is wired in. */
export const noopLearningMemory: LearningMemoryPort = {
  list: () => [],
  append: () => 0,
};

export type ProductLearningSnapshot = {
  workspaceId: string;
  simulationId: string;
  memories: readonly LearningMemoryRecord[];
  successfulFuture: RankedFutureSignal | null;
  preferenceHints: readonly string[];
};

function slug(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "unknown"
  );
}

function learningId(parts: string[]): string {
  return stableUuidFromSeed(`learning:${parts.join(":")}`);
}

/**
 * Derive reusable memory from a ranked decision (product simulation path).
 */
export function deriveProductLearning(input: {
  workspaceId: string;
  simulationId: string;
  recommendation?: string;
  futures?: readonly RankedFutureSignal[];
  now?: string;
}): ProductLearningSnapshot {
  const now = input.now ?? new Date().toISOString();
  const futures = [...(input.futures ?? [])].sort(
    (a, b) =>
      (a.rank ?? Number.MAX_SAFE_INTEGER) - (b.rank ?? Number.MAX_SAFE_INTEGER) ||
      b.score - a.score ||
      a.name.localeCompare(b.name)
  );

  const top = futures[0] ?? null;
  const losers = futures.slice(1);
  const memories: LearningMemoryRecord[] = [];

  if (top) {
    memories.push({
      id: learningId(["outcome", input.simulationId, top.id]),
      workspaceId: input.workspaceId,
      simulationId: input.simulationId,
      kind: "outcome",
      // Written at prediction time — nothing has happened yet, so this must not
      // claim success. Real results come from deriveOutcomeLearning.
      content: `Predicted best future: ${top.name} (score ${top.score.toFixed(3)}${
        typeof top.expectedValue === "number" ? `, EV ${top.expectedValue.toFixed(3)}` : ""
      }).`,
      metadata: {
        source: "learning",
        learningKey: `outcome:${input.simulationId}:${top.id}`,
        futureId: top.id,
        name: top.name,
        score: top.score,
        risk: top.risk ?? null,
        expectedValue: top.expectedValue ?? null,
        rank: top.rank ?? 1,
      },
      createdAt: now,
    });
  }

  if (input.recommendation?.trim()) {
    memories.push({
      id: learningId(["decision", input.simulationId]),
      workspaceId: input.workspaceId,
      simulationId: input.simulationId,
      kind: "decision",
      content: input.recommendation.trim().slice(0, 500),
      metadata: {
        source: "learning",
        learningKey: `decision:${input.simulationId}`,
        topFutureId: top?.id ?? null,
        topFutureName: top?.name ?? null,
      },
      createdAt: now,
    });
  }

  const preferenceHints: string[] = [];
  for (const loser of losers) {
    const risk = loser.risk ?? 0.5;
    if (risk >= 0.55 || (top && loser.score < top.score - 0.05)) {
      const hint = `Prefer paths resembling "${top?.name ?? "top ranked"}" over "${loser.name}" when similar trade-offs appear.`;
      preferenceHints.push(hint);
      memories.push({
        id: learningId(["pref", input.simulationId, slug(loser.id)]),
        workspaceId: input.workspaceId,
        simulationId: input.simulationId,
        kind: "preference",
        content: hint,
        metadata: {
          source: "learning",
          learningKey: `pref:${input.simulationId}:${slug(loser.id)}`,
          avoidedFutureId: loser.id,
          avoidedName: loser.name,
          avoidedScore: loser.score,
          avoidedRisk: risk,
        },
        createdAt: now,
      });
    }
  }

  // Cap preference noise — keep strongest few
  const capped = [
    ...memories.filter((m) => m.kind !== "preference"),
    ...memories.filter((m) => m.kind === "preference").slice(0, 3),
  ];

  return {
    workspaceId: input.workspaceId,
    simulationId: input.simulationId,
    memories: capped,
    successfulFuture: top,
    preferenceHints: preferenceHints.slice(0, 3),
  };
}
