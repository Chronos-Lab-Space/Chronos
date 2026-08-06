import type { GoalRecord, SimulationRecord, WorkspaceHome } from "./types";

/**
 * Outcome review — chasing the answers calibration needs.
 *
 * `calibration.ts` measures what confidence has been worth, but it needs five
 * followed, verdicted runs in a band before it will report a rate. Nothing ever
 * asked the user to come back and log one, so the bands stayed under sample and
 * the confidence number stayed decoration.
 *
 * This module is the other half: the user names a review horizon when they save
 * a decision, and the workspace home surfaces it when that date arrives.
 *
 * It reports; it never decides. Nothing here reaches ranking, scoring, or
 * confidence. See docs/superpowers/specs/2026-08-06-outcome-loop-design.md.
 */

export const REVIEW_HORIZONS = [
  { id: "2w", label: "2 weeks", days: 14 },
  { id: "1m", label: "1 month", days: 30 },
  { id: "3m", label: "3 months", days: 90 },
  { id: "never", label: "No review", days: null },
] as const;

export type ReviewHorizonId = (typeof REVIEW_HORIZONS)[number]["id"];

/**
 * Preselected at Save Decision. A default is the difference between a queue
 * that fills and one that stays empty — but it is a suggestion, not a claim
 * about the right horizon for this decision, so the user can always change it.
 */
export const DEFAULT_REVIEW_HORIZON: ReviewHorizonId = "2w";

const DAY_MS = 24 * 60 * 60 * 1000;

/** The review instant for a horizon, or null when the user opted out. */
export function reviewAtFor(horizonId: ReviewHorizonId, from: Date): string | null {
  const horizon = REVIEW_HORIZONS.find((h) => h.id === horizonId);
  if (!horizon || horizon.days === null) return null;
  return new Date(from.getTime() + horizon.days * DAY_MS).toISOString();
}

export type ReviewItem = {
  simulationId: string;
  /** What the user recognises the decision by, not the run title. */
  decisionTitle: string;
  chosenPathName: string;
  reviewAt: string;
  /** 0 = due today. Never negative: not-yet-due runs are not ReviewItems. */
  daysOverdue: number;
  href: string;
};

export type OutcomeReview = {
  /** Due now, oldest first. */
  due: readonly ReviewItem[];
  /** Has a review date still in the future. */
  upcomingCount: number;
  /**
   * Saved and unverdicted with no usable review date — "never", legacy saves,
   * and unparseable dates. Derived so calibration's `unverifiedCount` has
   * something to reconcile against; not rendered yet.
   */
  awaitingCount: number;
};

const EMPTY: OutcomeReview = { due: [], upcomingCount: 0, awaitingCount: 0 };

function parseIso(value: unknown): Date | null {
  if (typeof value !== "string") return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Runs whose outcome could still be logged and measured. */
function isOpenForReview(sim: SimulationRecord): boolean {
  if (sim.status !== "completed") return false;
  if (!sim.result.chosen_at) return false;
  // A logged verdict is the answer this queue exists to collect.
  if (sim.result.outcome_verdict) return false;
  // Calibration counts a not-followed run under excludedNotFollowed and can
  // never measure it, so asking again would be a nag no measurement consumes.
  if (sim.result.outcome_followed === "no") return false;
  return true;
}

function titleFor(sim: SimulationRecord, goal: GoalRecord | null): string {
  return goal?.title?.trim() || sim.title;
}

export function deriveOutcomeReview(
  home: WorkspaceHome | null | undefined,
  now: Date
): OutcomeReview {
  if (!home) return EMPTY;

  const due: ReviewItem[] = [];
  let upcomingCount = 0;
  let awaitingCount = 0;

  for (const sim of home.recentSimulations) {
    if (!isOpenForReview(sim)) continue;

    const reviewAt = parseIso(sim.result.review_at);
    if (!reviewAt) {
      // No date, an explicit opt-out, or a corrupt one. A malformed payload
      // must not pin an undismissable row to the home page.
      awaitingCount += 1;
      continue;
    }

    if (reviewAt.getTime() > now.getTime()) {
      upcomingCount += 1;
      continue;
    }

    due.push({
      simulationId: sim.id,
      decisionTitle: titleFor(sim, home.goal),
      chosenPathName: sim.result.chosen_future_name ?? "",
      reviewAt: reviewAt.toISOString(),
      daysOverdue: Math.floor((now.getTime() - reviewAt.getTime()) / DAY_MS),
      href: `/workspace/simulations/${sim.id}#outcome`,
    });
  }

  due.sort((a, b) => a.reviewAt.localeCompare(b.reviewAt));

  return { due, upcomingCount, awaitingCount };
}
