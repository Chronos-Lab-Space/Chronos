import { useMemo } from "react";
import {
  deriveFutureHooks,
  futureCardLabel,
  type FutureHookLabel,
} from "../../../../domain/workspace/timeline";
import { confidencePercent } from "../../../../domain/workspace/seed";
import type { FutureRecord } from "../../../../domain/workspace/types";

const HOOK_TONE: Record<FutureHookLabel, string> = {
  "Fastest path": "bg-chronos/20 text-chronos ring-chronos/30",
  "Lower risk": "bg-emerald-500/15 text-emerald-300 ring-emerald-500/25",
  "Highest upside": "bg-amber-500/15 text-amber-200 ring-amber-500/25",
};

/** Multi-future comparison — Chronos moat (not a single recommendation). */
export function FutureComparison({
  futures,
  chosenFutureId = null,
  selectedId = null,
  onSelect,
}: {
  futures: readonly FutureRecord[];
  chosenFutureId?: string | null;
  selectedId?: string | null;
  onSelect?: (id: string) => void;
}) {
  const hooks = useMemo(() => deriveFutureHooks(futures), [futures]);

  if (!futures.length) {
    return (
      <section className="rounded-2xl border border-dashed border-line p-5">
        <div className="font-mono text-[10px] uppercase text-ink-faint">Future comparison</div>
        <p className="mt-3 text-sm text-ink-dim">No futures ranked yet.</p>
      </section>
    );
  }

  const maxConf = Math.max(...futures.map((f) => f.confidence), 0.01);

  return (
    <section className="rounded-2xl border border-chronos/35 bg-gradient-to-b from-chronos/10 to-bg p-5 sm:p-6">
      <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-chronos">
        Future comparison
      </div>
      <p className="mt-1 max-w-xl text-sm text-ink-dim">
        Not a single answer — ranked paths with distinct trade-offs. Pick the future that fits.
      </p>

      {/* Mobile-first stack; sm+ becomes a clear multi-column wow grid */}
      <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {futures.map((future, index) => {
          const confPct = Math.round(future.confidence * 100);
          const bar = Math.round((future.confidence / maxConf) * 100);
          const isBest = index === 0;
          const isChosen = future.id === chosenFutureId;
          const isSelected = future.id === selectedId;
          const hook = hooks.get(future.id) ?? null;
          const letter = futureCardLabel(index);

          const card = (
            <>
              <div className="flex items-start justify-between gap-3">
                <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-faint">
                  Future {letter}
                  {isBest ? " · engine best" : ""}
                  {isChosen ? " · chosen" : ""}
                </div>
                {hook && (
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] ring-1 ${HOOK_TONE[hook]}`}
                  >
                    {hook}
                  </span>
                )}
              </div>

              <div
                className={`mt-3 font-serif text-xl leading-snug sm:text-2xl ${
                  isBest ? "text-ink" : "text-ink-dim"
                }`}
              >
                {future.name}
              </div>

              <div className="mt-4 flex items-end justify-between gap-3">
                <div>
                  <div className="font-mono text-[10px] uppercase text-ink-faint">Confidence</div>
                  <div
                    className={`mt-0.5 font-mono text-3xl tabular-nums sm:text-4xl ${
                      isBest ? "text-chronos" : "text-ink"
                    }`}
                  >
                    {confPct}%
                  </div>
                </div>
                <div className="text-right font-mono text-[11px] text-ink-faint">
                  <div>Risk {confidencePercent(future.risk)}</div>
                  <div className="mt-0.5">Score {future.score.toFixed(2)}</div>
                </div>
              </div>

              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-bg">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${bar}%`,
                    background: isBest ? "#60899b" : "rgba(96,137,155,0.45)",
                  }}
                />
              </div>

              {future.summary ? (
                <p className="mt-3 line-clamp-2 text-sm text-ink-dim">{future.summary}</p>
              ) : null}
            </>
          );

          return (
            <li key={future.id}>
              {onSelect ? (
                <button
                  type="button"
                  onClick={() => onSelect(future.id)}
                  className={`h-full w-full rounded-2xl border px-4 py-4 text-left transition ${
                    isSelected
                      ? "border-chronos/50 bg-bg/70 ring-1 ring-chronos/40"
                      : "border-line/80 bg-bg/40 hover:border-chronos/35 hover:bg-bg/60"
                  }`}
                >
                  {card}
                </button>
              ) : (
                <div
                  className={`h-full rounded-2xl border px-4 py-4 ${
                    isBest ? "border-chronos/40 bg-bg/50" : "border-line/80 bg-bg/40"
                  }`}
                >
                  {card}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
