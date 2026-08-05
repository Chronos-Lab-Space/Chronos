import type { GoalRecord } from "./types";

/**
 * Targets — the measurable outcomes this decision has to hit.
 *
 * Echoed from the objective the user wrote, never invented: a target appears
 * only because they put a number next to a word. An objective with no
 * measurable phrases yields none, and the rail says so rather than guessing.
 */

export type DecisionTarget = {
  /** The quantity as written — "1,000", "40%", "$5k". */
  value: string;
  /** What is being measured, lowercased — "signups", "retention". */
  label: string;
};

/** Four fills the rail without turning it into a wall of numbers. */
const MAX_TARGETS = 4;

/**
 * A quantity followed by the word it measures.
 *
 * The lookbehind keeps version strings out: the `2` in `v2` is preceded by a
 * letter, so it never starts a match. The trailing word is required — a bare
 * number is a number, not a target.
 */
const MEASURE_RE = /(?<![A-Za-z0-9])(\$?\d[\d,]*(?:\.\d+)?\s*[km]?%?)\s+([a-z][a-z-]*)/gi;

/** A date is a deadline, not a target: "12 Aug" must not read as 12 of something. */
const MONTHS = new Set([
  "jan",
  "january",
  "feb",
  "february",
  "mar",
  "march",
  "apr",
  "april",
  "may",
  "jun",
  "june",
  "jul",
  "july",
  "aug",
  "august",
  "sep",
  "sept",
  "september",
  "oct",
  "october",
  "nov",
  "november",
  "dec",
  "december",
]);

export function deriveTargets(goal: GoalRecord | null): DecisionTarget[] {
  if (!goal) return [];

  const text = `${goal.title ?? ""} ${goal.description ?? ""}`.trim();
  if (!text) return [];

  const targets: DecisionTarget[] = [];
  const seen = new Set<string>();

  for (const match of text.matchAll(MEASURE_RE)) {
    const value = match[1].replace(/\s+/g, "");
    const label = match[2].toLowerCase();
    if (MONTHS.has(label)) continue;

    const key = `${value.toLowerCase()} ${label}`;
    if (seen.has(key)) continue;
    seen.add(key);

    targets.push({ value, label });
    if (targets.length === MAX_TARGETS) break;
  }

  return targets;
}
