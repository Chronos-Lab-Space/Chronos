import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { deriveDecisionHistory } from "../../../domain/workspace/decisionHistory";
import { formatRelativeTime } from "../../../domain/workspace/pulse";
import { confidencePercent } from "../../../domain/workspace/seed";
import { futureCardLabel } from "../../../domain/workspace/timeline";
import type { FutureRecord } from "../../../domain/workspace/types";
import { useWorkspace } from "../workspace/WorkspaceContext";

/**
 * Timeline — decision history (canonical) + optional latest future path cards.
 * Same history model as HQ preview.
 */
export function TimelinePage() {
  const { home, chooseBestPath } = useWorkspace();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const history = useMemo(() => (home ? deriveDecisionHistory(home) : []), [home]);

  const latest = home?.recentSimulations[0] ?? null;
  const futures = useMemo((): FutureRecord[] => {
    if (!home || !latest) return [];
    return [...(home.futuresBySimulation[latest.id] ?? [])];
  }, [home, latest]);

  if (!home?.goal) return null;

  const chosenId =
    latest && typeof latest.result.chosen_future_id === "string"
      ? latest.result.chosen_future_id
      : null;
  const activeId = selectedId ?? chosenId ?? futures[0]?.id ?? null;
  const active = futures.find((f) => f.id === activeId) ?? null;
  const activeIndex = active ? futures.findIndex((f) => f.id === active.id) : -1;

  // Full history oldest → newest for narrative
  const narrative = history;

  return (
    <div className="mx-auto max-w-xl space-y-12">
      <div>
        <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-faint">
          Timeline
        </div>
        <h1 className="mt-2 font-serif text-4xl leading-tight text-ink sm:text-5xl">
          Decision history
        </h1>
        <p className="mt-3 font-serif text-lg leading-relaxed text-ink-dim">
          Workspace → knowledge → simulations → recommendation → decision → outcome.
        </p>
      </div>

      <section data-testid="decision-history-full">
        {narrative.length === 0 ? (
          <p className="text-sm text-ink-dim">No events yet.</p>
        ) : (
          <ol className="space-y-0">
            {narrative.map((e, i) => (
              <li key={e.id}>
                {i > 0 && <Connector />}
                {e.href ? (
                  <Link
                    to={e.href}
                    className="block rounded-2xl border border-line bg-bg-soft/20 px-5 py-4 transition hover:border-chronos/40"
                  >
                    <HistoryRow label={e.label} at={e.at} kind={e.kind} />
                  </Link>
                ) : (
                  <div className="rounded-2xl border border-line bg-bg-soft/20 px-5 py-4">
                    <HistoryRow label={e.label} at={e.at} kind={e.kind} />
                  </div>
                )}
              </li>
            ))}
          </ol>
        )}
      </section>

      {/* Latest future path — secondary */}
      <section>
        <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-faint">
          Latest futures
        </div>
        <p className="mt-1 text-sm text-ink-dim">Ranked paths from the most recent simulation.</p>

        <div className="mt-6 space-y-0">
          <div className="rounded-2xl border border-line bg-bg-soft/25 px-5 py-5">
            <div className="font-mono text-[10px] uppercase text-ink-faint">Goal</div>
            <div className="mt-2 font-serif text-2xl text-ink">{home.goal.title}</div>
          </div>

          <Connector />

          {!latest || !futures.length ? (
            <div className="rounded-2xl border border-dashed border-line px-5 py-8 text-center">
              <p className="text-sm text-ink-dim">No futures yet.</p>
              <Link
                to="/workspace/simulations?new=1"
                className="mt-4 inline-flex rounded-full bg-ink px-5 py-2.5 text-sm text-bg hover:bg-chronos"
              >
                Run Simulation
              </Link>
            </div>
          ) : (
            <>
              {futures.map((future, index) => (
                <div key={future.id}>
                  {index > 0 && <Connector />}
                  <button
                    type="button"
                    onClick={() => setSelectedId(future.id)}
                    className={`w-full rounded-2xl border px-5 py-5 text-left ${
                      future.id === activeId
                        ? "border-chronos/50 bg-chronos/10"
                        : "border-line hover:border-chronos/30"
                    }`}
                  >
                    <div className="flex justify-between gap-3">
                      <div>
                        <div className="font-mono text-[10px] uppercase text-ink-faint">
                          Future {futureCardLabel(index)}
                          {index === 0 ? " ⭐" : ""}
                          {future.id === chosenId ? " · chosen" : ""}
                        </div>
                        <div className="mt-1 font-serif text-xl text-ink">{future.name}</div>
                        <p className="mt-2 line-clamp-2 text-sm text-ink-dim">{future.summary}</p>
                      </div>
                      <div className="font-mono text-2xl text-chronos">
                        {confidencePercent(future.confidence)}
                      </div>
                    </div>
                  </button>
                </div>
              ))}

              {active && latest && (
                <>
                  <Connector />
                  <div className="rounded-2xl border border-line px-5 py-5">
                    <div className="font-mono text-[10px] uppercase text-chronos">
                      Selected · Future {futureCardLabel(activeIndex)}
                    </div>
                    <h2 className="mt-2 font-serif text-2xl text-ink">{active.name}</h2>
                    <p className="mt-3 text-sm text-ink-dim">{active.summary}</p>
                    <div className="mt-5 flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={saving || active.id === chosenId}
                        onClick={async () => {
                          setSaving(true);
                          try {
                            await chooseBestPath(latest.id, active.id);
                          } finally {
                            setSaving(false);
                          }
                        }}
                        className="rounded-full bg-ink px-4 py-2 text-sm text-bg hover:bg-chronos disabled:opacity-50"
                      >
                        {active.id === chosenId
                          ? "Path saved"
                          : saving
                            ? "Saving…"
                            : "Choose this path · Save timeline"}
                      </button>
                      <Link
                        to={`/workspace/simulations/${latest.id}`}
                        className="rounded-full border border-line px-4 py-2 text-sm text-ink hover:text-chronos"
                      >
                        Open simulation →
                      </Link>
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </section>
    </div>
  );
}

function HistoryRow({ label, at, kind }: { label: string; at: string; kind: string }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div>
        <div className="font-mono text-[10px] uppercase text-ink-faint">
          {kind.replace(/_/g, " ")}
        </div>
        <div className="mt-1 text-[15px] text-ink">{label}</div>
      </div>
      <div className="font-mono text-[10px] uppercase text-ink-faint">{formatRelativeTime(at)}</div>
    </div>
  );
}

function Connector() {
  return (
    <div className="flex justify-center py-1.5 text-ink-faint" aria-hidden>
      ↓
    </div>
  );
}
