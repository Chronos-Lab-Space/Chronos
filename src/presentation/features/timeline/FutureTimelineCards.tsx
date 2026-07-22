import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  deriveFutureHooks,
  deriveNextSteps,
  futureCardLabel,
  type FutureHookLabel,
} from "../../../domain/workspace/timeline";
import { confidencePercent } from "../../../domain/workspace/seed";
import type { FutureRecord } from "../../../domain/workspace/types";

type Props = {
  goalTitle: string;
  futures: readonly FutureRecord[];
  simulationRisks?: readonly string[];
  chosenFutureId?: string | null;
  selectedId?: string | null;
  onSelect?: (futureId: string) => void;
  onChoosePath?: (futureId: string) => Promise<void> | void;
};

const HOOK_TONE: Record<FutureHookLabel, string> = {
  "Fastest path": "text-chronos",
  "Lower risk": "text-emerald-300",
  "Highest upside": "text-amber-200",
};

/**
 * Choose path + save to timeline — the close of the product loop.
 * Comparison lives in FutureComparison; this is commit + next steps.
 */
export function FutureTimelineCards({
  goalTitle,
  futures,
  simulationRisks = [],
  chosenFutureId = null,
  selectedId: controlledSelectedId = null,
  onSelect,
  onChoosePath,
}: Props) {
  const hooks = useMemo(() => deriveFutureHooks(futures), [futures]);
  const [internalSelectedId, setInternalSelectedId] = useState<string | null>(
    controlledSelectedId ?? chosenFutureId ?? futures[0]?.id ?? null
  );
  const [saving, setSaving] = useState(false);

  const selectedId = controlledSelectedId ?? internalSelectedId;

  useEffect(() => {
    if (controlledSelectedId) return;
    if (chosenFutureId && futures.some((f) => f.id === chosenFutureId)) {
      setInternalSelectedId(chosenFutureId);
      return;
    }
    if (!futures.some((f) => f.id === internalSelectedId)) {
      setInternalSelectedId(futures[0]?.id ?? null);
    }
  }, [futures, internalSelectedId, chosenFutureId, controlledSelectedId]);

  const setSelected = (id: string) => {
    if (onSelect) onSelect(id);
    else setInternalSelectedId(id);
  };

  const selected = futures.find((f) => f.id === selectedId) ?? null;
  const selectedIndex = selected ? futures.findIndex((f) => f.id === selected.id) : -1;
  const isBest = selectedIndex === 0;
  const isChosen = Boolean(selected && chosenFutureId === selected.id);
  const selectedHook = selected ? hooks.get(selected.id) ?? null : null;

  if (futures.length === 0) {
    return (
      <section className="border border-line p-5">
        <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-faint">
          Save timeline
        </div>
        <p className="mt-3 text-sm text-ink-dim">Run a simulation to choose a path.</p>
      </section>
    );
  }

  const handleChoose = async () => {
    if (!selected || !onChoosePath) return;
    setSaving(true);
    try {
      await onChoosePath(selected.id);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="space-y-6">
      <div>
        <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-faint">
          Choose path · Save timeline
        </div>
        <p className="mt-1 text-sm text-ink-dim">
          Commit the future you want Chronos to remember for this decision.
        </p>
      </div>

      <div className="rounded-2xl border border-line bg-bg-soft/30 px-4 py-4">
        <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-faint">
          Decision
        </div>
        <div className="mt-1 font-serif text-2xl text-ink">{goalTitle}</div>
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        {futures.map((future, index) => {
          const best = index === 0;
          const active = future.id === selectedId;
          const chosen = future.id === chosenFutureId;
          const hook = hooks.get(future.id) ?? null;
          return (
            <button
              key={future.id}
              type="button"
              onClick={() => setSelected(future.id)}
              className={`rounded-2xl border px-4 py-3 text-left transition ${
                active ? "border-chronos/50 bg-chronos/10" : "border-line bg-bg hover:border-chronos/30"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-faint">
                  Future {futureCardLabel(index)}
                  {best ? " ⭐" : ""}
                  {chosen ? " · saved" : ""}
                </span>
                <span className="font-mono text-[11px] text-chronos">
                  {confidencePercent(future.confidence)}
                </span>
              </div>
              <div className="mt-1 truncate text-[15px] text-ink">{future.name}</div>
              {hook && (
                <div
                  className={`mt-1 font-mono text-[10px] uppercase tracking-[0.12em] ${HOOK_TONE[hook]}`}
                >
                  {hook}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {selected && (
        <div className="rounded-2xl border border-chronos/30 bg-gradient-to-b from-chronos/5 to-bg p-5">
          <div className="flex flex-wrap items-center gap-2">
            <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-chronos">
              Future {futureCardLabel(selectedIndex)}
              {isBest ? " ⭐" : ""}
              {isChosen ? " · your choice" : ""}
            </div>
            {selectedHook && (
              <span className={`font-mono text-[10px] uppercase tracking-[0.12em] ${HOOK_TONE[selectedHook]}`}>
                {selectedHook}
              </span>
            )}
          </div>
          <div className="mt-2 font-serif text-xl text-ink">{selected.name}</div>
          <p className="mt-3 text-sm text-ink-dim">{selected.summary || "—"}</p>
          <div className="mt-4 flex flex-wrap gap-4 font-mono text-sm">
            <span className="text-chronos">
              Confidence {confidencePercent(selected.confidence)}
            </span>
            <span className="text-ink-dim">Risk {(selected.risk * 100).toFixed(0)}%</span>
            <span className="text-ink-dim">Score {selected.score.toFixed(2)}</span>
          </div>
          {isBest && simulationRisks.length > 0 && (
            <ul className="mt-3 list-disc space-y-1 pl-4 text-sm text-ink-dim">
              {simulationRisks.slice(0, 4).map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          )}
          <ol className="mt-4 list-decimal space-y-1 pl-5 text-sm text-ink-dim">
            {deriveNextSteps(selected, isBest).map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
          {onChoosePath && (
            <div className="mt-6 flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={saving || isChosen}
                onClick={() => void handleChoose()}
                className="rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-bg hover:bg-chronos disabled:opacity-50"
              >
                {isChosen
                  ? "Path saved to timeline"
                  : saving
                    ? "Saving…"
                    : "Choose this path · Save timeline"}
              </button>
              {isChosen && (
                <Link
                  to="/workspace/memory"
                  className="rounded-full border border-chronos/40 bg-chronos/10 px-5 py-2.5 text-sm font-medium text-chronos transition hover:bg-chronos/20"
                >
                  View in Memory →
                </Link>
              )}
            </div>
          )}
          {isChosen && (
            <p className="mt-3 text-sm text-ink-dim">
              This decision is now in persistent memory — reopen, compare versions, and log
              outcomes anytime from{" "}
              <Link to="/workspace/memory" className="text-chronos hover:underline">
                Memory
              </Link>
              .
            </p>
          )}
        </div>
      )}
    </section>
  );
}
