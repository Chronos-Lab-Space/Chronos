import type { SimulationRecord } from "./types";

/**
 * Simulation history buckets for a calm, scannable product list.
 * Today · Yesterday · Last week · Earlier
 */
export type HistoryBucketId = "today" | "yesterday" | "last_week" | "earlier";

export type SimulationHistoryBucket = {
  id: HistoryBucketId;
  label: string;
  simulations: SimulationRecord[];
};

const DAY_MS = 86_400_000;

function startOfLocalDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

export function historyBucketFor(
  iso: string,
  now: Date = new Date()
): HistoryBucketId {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "earlier";

  const todayStart = startOfLocalDay(now);
  const yesterdayStart = todayStart - DAY_MS;
  const weekStart = todayStart - 7 * DAY_MS;

  if (then >= todayStart) return "today";
  if (then >= yesterdayStart) return "yesterday";
  if (then >= weekStart) return "last_week";
  return "earlier";
}

const BUCKET_ORDER: HistoryBucketId[] = ["today", "yesterday", "last_week", "earlier"];

const LABELS: Record<HistoryBucketId, string> = {
  today: "Today",
  yesterday: "Yesterday",
  last_week: "Last week",
  earlier: "Earlier",
};

/**
 * Group simulations newest-first within each time bucket.
 * Empty buckets are omitted.
 */
export function groupSimulationsByHistory(
  simulations: readonly SimulationRecord[],
  now: Date = new Date()
): SimulationHistoryBucket[] {
  const sorted = [...simulations].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  const map = new Map<HistoryBucketId, SimulationRecord[]>();
  for (const id of BUCKET_ORDER) map.set(id, []);

  for (const sim of sorted) {
    const bucket = historyBucketFor(sim.created_at, now);
    map.get(bucket)!.push(sim);
  }

  return BUCKET_ORDER.filter((id) => (map.get(id)?.length ?? 0) > 0).map((id) => ({
    id,
    label: LABELS[id],
    simulations: map.get(id)!,
  }));
}
