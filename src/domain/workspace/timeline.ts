import type { FutureRecord } from "./types";

const LABELS = ["A", "B", "C", "D", "E", "F", "G", "H"] as const;

/** Distinctive “wow” labels — Chronos shows trade-offs, not a single answer. */
export type FutureHookLabel = "Fastest path" | "Lower risk" | "Highest upside";

export function futureCardLabel(index: number): string {
  return LABELS[index] ?? String(index + 1);
}

/**
 * Assign at most one distinctive hook per future so comparison reads as:
 * Future A · 92% · Fastest path | Future B · Lower risk | Future C · Highest upside
 *
 * Roles are exclusive. Priority when metrics collide: fastest → lower risk → upside.
 */
export function deriveFutureHooks(
  futures: readonly FutureRecord[]
): ReadonlyMap<string, FutureHookLabel> {
  const hooks = new Map<string, FutureHookLabel>();
  if (futures.length === 0) return hooks;

  const taken = new Set<string>();

  const pick = (
    candidates: readonly FutureRecord[],
    compare: (a: FutureRecord, b: FutureRecord) => number
  ): FutureRecord | null => {
    const open = candidates.filter((f) => !taken.has(f.id));
    if (!open.length) return null;
    return [...open].sort(compare)[0] ?? null;
  };

  // Fastest path = highest confidence (engine signal that the path is most certain)
  const fastest = pick(
    futures,
    (a, b) => b.confidence - a.confidence || b.score - a.score
  );
  if (fastest) {
    hooks.set(fastest.id, "Fastest path");
    taken.add(fastest.id);
  }

  // Lower risk = lowest risk among remaining
  const safer = pick(futures, (a, b) => a.risk - b.risk || b.confidence - a.confidence);
  if (safer) {
    hooks.set(safer.id, "Lower risk");
    taken.add(safer.id);
  }

  // Highest upside = best score / (risk + floor) among remaining
  const upside = pick(futures, (a, b) => {
    const ua = a.score / (a.risk + 0.15);
    const ub = b.score / (b.risk + 0.15);
    return ub - ua || b.score - a.score;
  });
  if (upside) {
    hooks.set(upside.id, "Highest upside");
    taken.add(upside.id);
  }

  return hooks;
}

export function futureHookFor(
  futureId: string,
  hooks: ReadonlyMap<string, FutureHookLabel>
): FutureHookLabel | null {
  return hooks.get(futureId) ?? null;
}

/** Lightweight next-step prompts for a selected future card. */
export function deriveNextSteps(future: FutureRecord, isBest: boolean): string[] {
  const steps: string[] = [];

  if (isBest) {
    steps.push(`Adopt “${future.name}” as the primary recommendation`);
  } else {
    steps.push(`Compare “${future.name}” against the starred best path`);
  }

  if (future.risk >= 0.55) {
    steps.push("Name owners for the top risks before committing");
  } else if (future.confidence >= 0.7) {
    steps.push("Draft a 30-day execution checklist for this path");
  } else {
    steps.push("Gather more knowledge to raise confidence on this path");
  }

  steps.push("Log a workspace note with the decision and why");

  // Keep summary-aware flavor without over-parsing
  const thesis = future.summary.trim();
  if (thesis) {
    const short = thesis.length > 90 ? `${thesis.slice(0, 87)}…` : thesis;
    steps.push(`Validate thesis: ${short}`);
  }

  return steps.slice(0, 4);
}

export const TIMELINE_LATER_FEATURES = [
  { id: "tree", label: "Tree" },
  { id: "branches", label: "Branches" },
  { id: "merge", label: "Merge" },
  { id: "collapse", label: "Collapse" },
  { id: "compare", label: "Compare" },
] as const;
