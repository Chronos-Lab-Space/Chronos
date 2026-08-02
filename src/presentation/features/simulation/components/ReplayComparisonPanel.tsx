import { deriveReplayComparison } from "../../../../domain/workspace/replayComparison";
import type { FutureRecord, SimulationRecord } from "../../../../domain/workspace/types";

/**
 * Deeper replay: after a re-run, show whether the recommendation or confidence
 * moved. Pure report — never adjusts scores.
 */
export function ReplayComparisonPanel({
  before,
  after,
  beforeFutures,
  afterFutures,
}: {
  before: SimulationRecord;
  after: SimulationRecord;
  beforeFutures: readonly FutureRecord[];
  afterFutures: readonly FutureRecord[];
}) {
  const cmp = deriveReplayComparison(before, after, beforeFutures, afterFutures);

  return (
    <section
      data-testid="replay-comparison"
      className="rounded-2xl border border-chronos/25 bg-chronos/5 p-5 sm:p-6"
    >
      <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-chronos">
        Replay comparison
      </div>
      <h2 className="mt-2 font-serif text-xl text-ink">
        v{before.version} → v{after.version}
      </h2>
      <p
        data-testid="replay-comparison-summary"
        className="mt-2 text-sm leading-relaxed text-ink-dim"
      >
        {cmp.summary}
      </p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <div className="font-mono text-[10px] uppercase text-ink-faint">Earlier top paths</div>
          <ul className="mt-2 space-y-1 text-sm text-ink">
            {cmp.beforeTop.map((n) => (
              <li key={`b-${n}`}>{n}</li>
            ))}
          </ul>
        </div>
        <div>
          <div className="font-mono text-[10px] uppercase text-ink-faint">This run top paths</div>
          <ul className="mt-2 space-y-1 text-sm text-ink">
            {cmp.afterTop.map((n) => (
              <li key={`a-${n}`}>{n}</li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
