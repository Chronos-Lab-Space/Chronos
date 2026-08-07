import { Link } from "react-router-dom";
import type { ReviewItem } from "../../../../domain/workspace/outcomeReview";

type Props = {
  items: readonly ReviewItem[];
};

function dueLabel(daysOverdue: number): string {
  if (daysOverdue <= 0) return "due today";
  return daysOverdue === 1 ? "due 1 day ago" : `due ${daysOverdue} days ago`;
}

/**
 * Decisions whose review date has arrived.
 *
 * Renders nothing when the queue is empty — a "0 decisions due" row is a
 * standing nag that carries no information. Each row deep-links to the outcome
 * panel rather than logging inline, so the user sees the prediction they are
 * being asked to judge.
 */
export function OutcomeReviewBanner({ items }: Props) {
  if (items.length === 0) return null;

  return (
    <section
      data-testid="outcome-review-banner"
      className="mb-8 rounded-xl border border-chronos/30 bg-chronos/[0.06] px-5 py-4"
    >
      <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-chronos">
        {items.length === 1 ? "1 decision to review" : `${items.length} decisions to review`}
      </div>
      <ul className="mt-3 space-y-2.5">
        {items.map((review) => (
          <li
            key={review.simulationId}
            className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1"
          >
            <div className="min-w-0">
              <span className="text-[15px] text-ink">{review.decisionTitle}</span>
              {review.chosenPathName ? (
                <span className="ml-2 text-[13px] text-ink-dim">{review.chosenPathName}</span>
              ) : null}
              <span className="ml-2 font-mono text-[11px] text-ink-faint">
                {dueLabel(review.daysOverdue)}
              </span>
            </div>
            <Link
              to={review.href}
              className="shrink-0 text-sm text-chronos transition hover:text-chronos/80"
            >
              Log outcome →
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
