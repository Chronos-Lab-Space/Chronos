import { Link } from "react-router-dom";
import {
  deriveDecisionCard,
  type DecisionCardModel,
} from "../../../../domain/workspace/decisionCard";
import { confidencePercent } from "../../../../domain/workspace/seed";
import type { WorkspaceHome } from "../../../../domain/workspace/types";
import { ConfidenceCaveatNote } from "../../memory/components/ConfidenceCaveatNote";

/**
 * HQ hero — recommendation + next action.
 * Deep-link only; never commits chooseBestPath.
 */
export function DecisionCard({ home }: { home: WorkspaceHome }) {
  const card = deriveDecisionCard(home);
  return <DecisionCardView card={card} home={home} />;
}

export function DecisionCardView({
  card,
  home,
}: {
  card: DecisionCardModel;
  /** When present, measured band history can caveat the claimed confidence. */
  home?: WorkspaceHome;
}) {
  const conf = card.confidence != null ? confidencePercent(card.confidence) : "—";

  return (
    <section
      data-testid="decision-card"
      className="relative overflow-hidden rounded-2xl border border-chronos/35 bg-gradient-to-br from-chronos/12 via-bg-soft/25 to-bg p-5 sm:p-6"
    >
      <div
        className="pointer-events-none absolute -right-8 top-1/2 h-40 w-40 -translate-y-1/2 rounded-full bg-chronos/10 blur-2xl"
        aria-hidden
      />
      <div className="relative">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-chronos">
            Recommendation
          </div>
          <span
            data-testid="decision-card-status"
            className="rounded-full border border-chronos/30 bg-bg/60 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-chronos"
          >
            {card.statusLabel}
          </span>
        </div>
        <p className="sr-only" data-testid="decision-card-goal">
          {card.decisionTitle}
        </p>

        <h2
          data-testid="decision-card-recommendation"
          className="mt-4 font-serif text-2xl text-ink sm:text-3xl"
        >
          {card.recommendation ?? "No recommendation available."}
        </h2>
        {card.reason ? (
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-ink-dim">{card.reason}</p>
        ) : (
          <p className="mt-3 max-w-xl text-sm text-ink-dim">
            Run a simulation to generate ranked futures and a recommendation.
          </p>
        )}

        {card.confidence != null ? (
          <div className="mt-4">
            <div className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-faint">
              Confidence <span className="text-chronos">{conf}</span>
            </div>
            {home && (
              <ConfidenceCaveatNote home={home} confidence={card.confidence} className="mt-1.5" />
            )}
          </div>
        ) : null}

        <div className="mt-6 flex flex-wrap gap-2">
          <Link
            to={card.primaryCtaHref}
            data-testid="decision-card-cta"
            className="inline-flex rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-bg transition hover:bg-chronos"
          >
            {card.primaryCtaLabel}
          </Link>
          {card.secondaryCtaLabel && card.secondaryCtaHref ? (
            <Link
              to={card.secondaryCtaHref}
              className="inline-flex rounded-full border border-line px-4 py-2.5 text-sm text-ink hover:border-chronos/50 hover:text-chronos"
            >
              {card.secondaryCtaLabel}
            </Link>
          ) : null}
        </div>
      </div>
    </section>
  );
}
