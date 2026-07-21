import { Link } from "react-router-dom";
import {
  betaChecklistProgress,
  type BetaChecklistItem,
} from "../../../../domain/workspace/betaChecklist";

type Props = {
  items: readonly BetaChecklistItem[];
};

/**
 * Natural progress unlock — not a tutorial carousel.
 */
export function BetaChecklist({ items }: Props) {
  const progress = betaChecklistProgress(items);
  if (progress.requiredDone >= progress.requiredTotal && items.every((i) => i.done || i.optional)) {
    return null;
  }

  return (
    <section className="rounded-2xl border border-chronos/30 bg-gradient-to-br from-chronos/10 via-bg to-bg p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-chronos">
            Beta progress
          </div>
          <p className="mt-2 text-sm text-ink-dim">
            Unlock Chronos by deciding — not by reading a tutorial.
          </p>
        </div>
        <div className="font-mono text-2xl tabular-nums text-chronos">{progress.percent}%</div>
      </div>

      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-bg">
        <div
          className="h-full rounded-full bg-chronos transition-all"
          style={{ width: `${progress.percent}%` }}
        />
      </div>

      <ul className="mt-5 space-y-2">
        {items.map((item) => (
          <li key={item.id}>
            <Link
              to={item.href}
              className={`flex items-start justify-between gap-3 rounded-xl border px-4 py-3 transition ${
                item.done
                  ? "border-line/60 bg-bg/40 opacity-80"
                  : "border-line hover:border-chronos/40 hover:bg-chronos/5"
              }`}
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[15px] text-ink">
                    {item.done ? "✓ " : "○ "}
                    {item.label}
                  </span>
                  {item.optional && (
                    <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-ink-faint">
                      optional
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-sm text-ink-dim">{item.detail}</p>
              </div>
              <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.12em] text-chronos">
                {item.cta} →
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
