import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  compareSimulations,
  groupByLineage,
  versionLabel,
} from "../../../domain/workspace/memory";
import { confidencePercent, formatCreatedAt } from "../../../domain/workspace/seed";
import { useWorkspace } from "../workspace/WorkspaceContext";

/**
 * Phase 6 — Persistent memory = history.
 * Workspace → Simulation → Future → Report · View · Re-run · Compare · Versions
 */
export function MemoryPage() {
  const { home } = useWorkspace();
  const lineages = useMemo(
    () => (home ? groupByLineage(home.recentSimulations) : []),
    [home]
  );

  if (!home) return null;

  return (
    <div>
      <div className="header-enter">
        <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-faint">
          Memory
        </div>
        <h1 className="mt-2 font-serif text-3xl text-ink">History</h1>
        <p className="mt-2 max-w-xl text-sm text-ink-dim">
          Every simulation is saved. Reopen a report, re-run a lineage, or compare versions. No AI
          memory — just durable history.
        </p>

        <div className="mt-4 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint">
          {home.workspace.name} · {home.recentSimulations.length} runs
        </div>
      </div>

      {lineages.length === 0 ? (
        <p className="workspace-panel-enter mt-8 text-sm text-ink-dim">
          No simulations yet.{" "}
          <Link to="/workspace/simulations?new=1" className="text-chronos">
            Run the engine
          </Link>
          .
        </p>
      ) : (
        <ul className="ws-cascade mt-8 space-y-6">
          {lineages.map((line) => (
            <li
              key={line.lineage_id}
              className="border border-line p-4 transition duration-200 hover:border-line-strong"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint">
                    Lineage · {line.versions.length} version
                    {line.versions.length === 1 ? "" : "s"}
                  </div>
                  <h2 className="mt-1 text-lg text-ink">{line.title}</h2>
                  <p className="mt-1 text-sm text-ink-dim">
                    Latest {versionLabel(line.latest)} ·{" "}
                    {confidencePercent(line.latest.confidence)} ·{" "}
                    {formatCreatedAt(line.latest.created_at)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link
                    to={`/workspace/simulations/${line.latest.id}`}
                    className="rounded-full border border-line px-3 py-1.5 text-xs text-ink hover:border-chronos/50 hover:text-chronos"
                  >
                    View
                  </Link>
                  <Link
                    to={`/workspace/simulations/${line.latest.id}?rerun=1`}
                    className="rounded-full border border-line px-3 py-1.5 text-xs text-ink hover:border-chronos/50 hover:text-chronos"
                  >
                    Re-run
                  </Link>
                  {line.versions.length >= 2 && (
                    <Link
                      to={`/workspace/memory/compare?a=${line.versions[line.versions.length - 1].id}&b=${line.latest.id}`}
                      className="rounded-full border border-line px-3 py-1.5 text-xs text-ink hover:border-chronos/50 hover:text-chronos"
                    >
                      Compare
                    </Link>
                  )}
                </div>
              </div>

              <ol className="mt-4 flex flex-wrap gap-2">
                {[...line.versions].reverse().map((v) => (
                  <li key={v.id}>
                    <Link
                      to={`/workspace/simulations/${v.id}`}
                      className="inline-flex items-center gap-2 rounded-full bg-bg px-3 py-1 font-mono text-[11px] text-ink-dim transition hover:text-chronos"
                    >
                      <span className="text-chronos">{versionLabel(v)}</span>
                      <span className="max-w-[10rem] truncate">
                        {String(v.result.best_future ?? "—")}
                      </span>
                    </Link>
                  </li>
                ))}
              </ol>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function ComparePage() {
  const { home } = useWorkspace();
  const [params, setParams] = useSearchParams();
  const aId = params.get("a") ?? "";
  const bId = params.get("b") ?? "";
  const [pickA, setPickA] = useState(aId);
  const [pickB, setPickB] = useState(bId);

  if (!home) return null;

  const sims = home.recentSimulations;
  const leftId = aId || pickA;
  const rightId = bId || pickB;
  const left = sims.find((s) => s.id === leftId);
  const right = sims.find((s) => s.id === rightId);

  const comparison =
    left && right
      ? compareSimulations(
          left,
          right,
          home.futuresBySimulation[left.id] ?? [],
          home.futuresBySimulation[right.id] ?? []
        )
      : null;

  return (
    <div>
      <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-faint">
        Memory
      </div>
      <h1 className="mt-2 font-serif text-3xl text-ink">Compare</h1>
      <p className="mt-2 text-sm text-ink-dim">
        Diff two saved simulations — versions in a lineage or separate runs.
      </p>

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint">
            Left
          </span>
          <select
            value={leftId}
            onChange={(e) => {
              setPickA(e.target.value);
              if (e.target.value && rightId) {
                setParams({ a: e.target.value, b: rightId });
              }
            }}
            className="mt-2 w-full rounded-lg border border-line bg-bg px-3 py-2 text-sm text-ink"
          >
            <option value="">Select…</option>
            {sims.map((s) => (
              <option key={s.id} value={s.id}>
                {versionLabel(s)} · {s.title}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint">
            Right
          </span>
          <select
            value={rightId}
            onChange={(e) => {
              setPickB(e.target.value);
              if (leftId && e.target.value) {
                setParams({ a: leftId, b: e.target.value });
              }
            }}
            className="mt-2 w-full rounded-lg border border-line bg-bg px-3 py-2 text-sm text-ink"
          >
            <option value="">Select…</option>
            {sims.map((s) => (
              <option key={s.id} value={s.id}>
                {versionLabel(s)} · {s.title}
              </option>
            ))}
          </select>
        </label>
      </div>

      {comparison && (
        <div className="mt-10 space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <CompareCard
              label={`Left · ${versionLabel(comparison.left)}`}
              sim={comparison.left}
              best={comparison.bestFutureLeft}
            />
            <CompareCard
              label={`Right · ${versionLabel(comparison.right)}`}
              sim={comparison.right}
              best={comparison.bestFutureRight}
            />
          </div>

          <dl className="space-y-3 border-y border-line py-4 text-sm">
            <Row
              label="Same lineage"
              value={comparison.sameLineage ? "Yes (version history)" : "No (independent runs)"}
            />
            <Row
              label="Best future changed"
              value={comparison.bestFutureChanged ? "Yes" : "No"}
            />
            <Row
              label="Confidence Δ"
              value={
                comparison.confidenceDelta == null
                  ? "—"
                  : `${comparison.confidenceDelta >= 0 ? "+" : ""}${(comparison.confidenceDelta * 100).toFixed(1)} pts`
              }
            />
          </dl>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <FutureList title="Left futures" futures={comparison.leftFutures} />
            <FutureList title="Right futures" futures={comparison.rightFutures} />
          </div>
        </div>
      )}

      <Link
        to="/workspace/memory"
        className="mt-10 inline-flex font-mono text-[11px] uppercase tracking-[0.16em] text-ink-dim hover:text-chronos"
      >
        ← Memory
      </Link>
    </div>
  );
}

function CompareCard({
  label,
  sim,
  best,
}: {
  label: string;
  sim: { title: string; confidence: number | null; created_at: string; id: string };
  best: string;
}) {
  return (
    <div className="border border-line p-4">
      <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-chronos">{label}</div>
      <div className="mt-2 text-ink">{sim.title}</div>
      <p className="mt-2 text-sm text-ink-dim">Best: {best}</p>
      <p className="mt-1 font-mono text-sm text-chronos">{confidencePercent(sim.confidence)}</p>
      <p className="mt-1 text-xs text-ink-faint">{formatCreatedAt(sim.created_at)}</p>
      <Link to={`/workspace/simulations/${sim.id}`} className="mt-3 inline-flex text-sm text-chronos">
        Open report →
      </Link>
    </div>
  );
}

function FutureList({
  title,
  futures,
}: {
  title: string;
  futures: readonly { id: string; name: string; confidence: number; summary: string }[];
}) {
  return (
    <div>
      <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint">{title}</div>
      <ul className="mt-2 divide-y divide-line border-y border-line">
        {futures.length === 0 ? (
          <li className="py-3 text-sm text-ink-dim">None</li>
        ) : (
          futures.map((f) => (
            <li key={f.id} className="py-3">
              <div className="flex justify-between gap-2 text-sm">
                <span className="text-ink">{f.name}</span>
                <span className="font-mono text-chronos">{confidencePercent(f.confidence)}</span>
              </div>
              <p className="mt-1 text-xs text-ink-dim line-clamp-2">{f.summary}</p>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap justify-between gap-2">
      <dt className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint">{label}</dt>
      <dd className="text-ink">{value}</dd>
    </div>
  );
}
