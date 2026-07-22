import { useEffect, useState } from "react";
import {
  deriveNextSteps,
  futureCardLabel,
  TIMELINE_LATER_FEATURES,
} from "../../../domain/workspace/timeline";
import { confidencePercent } from "../../../domain/workspace/seed";
import type { FutureRecord } from "../../../domain/workspace/types";

type Props = {
  goalTitle: string;
  futures: readonly FutureRecord[];
  /** Optional risks from the simulation for the best path */
  simulationRisks?: readonly string[];
};

/**
 * Phase 5 — card timeline (not a graph).
 * Goal → Future A ⭐ / B / C / D · click for summary, risk, confidence, next steps.
 */
export function FutureTimelineCards({
  goalTitle,
  futures,
  simulationRisks = [],
}: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(futures[0]?.id ?? null);

  useEffect(() => {
    if (!futures.some((f) => f.id === selectedId)) {
      setSelectedId(futures[0]?.id ?? null);
    }
  }, [futures, selectedId]);

  const selected = futures.find((f) => f.id === selectedId) ?? null;
  const selectedIndex = selected ? futures.findIndex((f) => f.id === selected.id) : -1;
  const isBest = selectedIndex === 0;

  if (futures.length === 0) {
    return (
      <section className="border border-line p-5">
        <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-faint">
          Timeline
        </div>
        <p className="mt-3 text-sm text-ink-dim">Run a simulation to see future cards.</p>
      </section>
    );
  }

  return (
    <section className="ws-cascade space-y-6">
      <div>
        <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-faint">
          Timeline
        </div>
        <p className="mt-1 text-sm text-ink-dim">Cards first. Tree and branches come later.</p>
      </div>

      {/* Goal */}
      <div className="rounded-2xl border border-line bg-bg-soft/30 px-4 py-4 transition hover:border-line-strong">
        <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-faint">Goal</div>
        <div className="mt-1 font-serif text-2xl text-ink">{goalTitle}</div>
      </div>

      <div className="flex justify-center text-ink-faint" aria-hidden>
        ↓
      </div>

      {/* Future cards */}
      <div className="ws-cascade space-y-3">
        {futures.map((future, index) => {
          const best = index === 0;
          const active = future.id === selectedId;
          const label = futureCardLabel(index);
          return (
            <button
              key={future.id}
              type="button"
              onClick={() => setSelectedId(future.id)}
              className={`w-full rounded-2xl border px-4 py-4 text-left transition duration-200 ${
                active
                  ? "border-chronos/50 bg-chronos/10"
                  : "border-line bg-bg hover:border-chronos/30"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-faint">
                    Future {label}
                    {best ? " ⭐" : ""}
                  </div>
                  <div className="mt-1 truncate text-[16px] text-ink">{future.name}</div>
                  <p className="mt-1 line-clamp-2 text-sm text-ink-dim">{future.summary}</p>
                </div>
                <div className="shrink-0 text-right font-mono text-[11px] text-chronos">
                  {confidencePercent(future.confidence)}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Selected detail */}
      {selected && (
        <div key={selected.id} className="workspace-panel-enter rounded-2xl border border-line p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-chronos">
              Future {futureCardLabel(selectedIndex)}
              {isBest ? " ⭐" : ""}
            </div>
            <div className="font-serif text-xl text-ink">{selected.name}</div>
          </div>

          <dl className="mt-5 space-y-4">
            <DetailBlock label="Summary">
              <p className="text-sm text-ink-dim">{selected.summary || "—"}</p>
            </DetailBlock>

            <DetailBlock label="Risk">
              <div className="flex items-center gap-3">
                <Meter value={selected.risk} tone="risk" />
                <span className="font-mono text-sm text-ink">
                  {(selected.risk * 100).toFixed(0)}%
                </span>
              </div>
              {isBest && simulationRisks.length > 0 && (
                <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-ink-dim">
                  {simulationRisks.slice(0, 4).map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              )}
            </DetailBlock>

            <DetailBlock label="Confidence">
              <div className="flex items-center gap-3">
                <Meter value={selected.confidence} tone="confidence" />
                <span className="font-mono text-sm text-chronos">
                  {confidencePercent(selected.confidence)}
                </span>
              </div>
            </DetailBlock>

            <DetailBlock label="Next steps">
              <ol className="list-decimal space-y-2 pl-5 text-sm text-ink-dim">
                {deriveNextSteps(selected, isBest).map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            </DetailBlock>
          </dl>
        </div>
      )}

      {/* Later roadmap — visible, not built */}
      <div className="border-t border-line pt-5">
        <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-faint">
          Later
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {TIMELINE_LATER_FEATURES.map((feature) => (
            <span
              key={feature.id}
              title="Coming later"
              className="cursor-default rounded-full border border-line px-3 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-faint opacity-70"
            >
              {feature.label}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

function DetailBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint">{label}</dt>
      <dd className="mt-2">{children}</dd>
    </div>
  );
}

function Meter({ value, tone }: { value: number; tone: "risk" | "confidence" }) {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
  const color = tone === "confidence" ? "#60899b" : "#989898";
  return (
    <div className="h-1.5 w-28 overflow-hidden rounded-full bg-bg" aria-hidden>
      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}
