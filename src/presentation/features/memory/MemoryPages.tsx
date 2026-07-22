import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  compareSimulations,
  groupByLineage,
  versionLabel,
} from "../../../domain/workspace/memory";
import { confidencePercent, formatCreatedAt } from "../../../domain/workspace/seed";
import {
  listDecisionHistory,
} from "../../../domain/workspace/workspaceMemory";
import { useWorkspace } from "../workspace/WorkspaceContext";

/**
 * Persistent memory — leave and come back to:
 * previous goals · simulations · decision history · knowledge · past outcomes
 */
export function MemoryPage() {
  const { home } = useWorkspace();
  const lineages = useMemo(
    () => (home ? groupByLineage(home.recentSimulations) : []),
    [home]
  );
  const decisions = useMemo(
    () => (home ? listDecisionHistory(home) : []),
    [home]
  );

  if (!home) return null;

  const previousGoals = home.goalHistory ?? [];

  return (
    <div className="space-y-12">
      <div>
        <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-faint">
          Memory
        </div>
        <h1 className="mt-2 font-serif text-3xl text-ink">History</h1>
        <p className="mt-2 max-w-xl text-sm text-ink-dim">
          Chronos keeps durable memory across sessions: goals, simulations, decisions,
          knowledge, and outcomes. Leave and come back — nothing resets.
        </p>
        <div className="mt-4 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint">
          {home.workspace.name} · {home.recentSimulations.length} runs ·{" "}
          {decisions.length} decisions · {home.knowledge.length} knowledge
        </div>
      </div>

      {/* Active + previous goals */}
      <section>
        <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-faint">
          Goals
        </div>
        <ul className="mt-4 space-y-3">
          {home.goal && (
            <li className="rounded-2xl border border-chronos/35 bg-chronos/5 px-4 py-4">
              <div className="font-mono text-[10px] uppercase text-chronos">Active</div>
              <div className="mt-1 font-serif text-xl text-ink">{home.goal.title}</div>
              {home.goal.description ? (
                <p className="mt-1 text-sm text-ink-dim">{home.goal.description}</p>
              ) : null}
            </li>
          )}
          {previousGoals.map((g) => (
            <li key={`${g.id}-${g.created_at}`} className="rounded-2xl border border-line px-4 py-3">
              <div className="font-mono text-[10px] uppercase text-ink-faint">Previous</div>
              <div className="mt-1 text-[15px] text-ink">{g.title}</div>
              <div className="mt-1 font-mono text-[11px] text-ink-faint">
                {formatCreatedAt(g.created_at)}
              </div>
            </li>
          ))}
          {!home.goal && previousGoals.length === 0 && (
            <p className="text-sm text-ink-dim">No goals yet.</p>
          )}
        </ul>
      </section>

      {/* Decision history + outcomes */}
      <section>
        <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-faint">
          Decision history
        </div>
        {decisions.length === 0 ? (
          <p className="mt-4 text-sm text-ink-dim">
            No saved paths yet.{" "}
            <Link to="/workspace/simulations?new=1" className="text-chronos">
              Generate futures
            </Link>{" "}
            and choose a path.
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {decisions.map((d) => (
              <li key={d.simulationId}>
                <Link
                  to={d.href}
                  className="block rounded-2xl border border-line px-4 py-4 transition hover:border-chronos/40"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="font-mono text-[10px] uppercase text-ink-faint">
                        {d.title}
                      </div>
                      <div className="mt-1 font-serif text-xl text-ink">{d.pathName}</div>
                    </div>
                    <div className="text-right font-mono text-[11px] text-ink-faint">
                      <div>{formatCreatedAt(d.chosenAt)}</div>
                      {d.confidence != null && (
                        <div className="mt-1 text-chronos">{confidencePercent(d.confidence)}</div>
                      )}
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-sm">
                    {d.followed ? (
                      <span className="rounded-full bg-chronos/15 px-2.5 py-0.5 font-mono text-[10px] uppercase text-chronos">
                        Followed: {d.followed}
                      </span>
                    ) : (
                      <span className="rounded-full border border-line px-2.5 py-0.5 font-mono text-[10px] uppercase text-ink-faint">
                        Outcome pending
                      </span>
                    )}
                    {d.outcomeResult && (
                      <span className="text-ink-dim">{d.outcomeResult}</span>
                    )}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Stored knowledge */}
      <section>
        <div className="flex items-baseline justify-between gap-3">
          <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-faint">
            Stored knowledge
          </div>
          <Link
            to="/workspace/knowledge"
            className="font-mono text-[10px] uppercase text-chronos"
          >
            Library →
          </Link>
        </div>
        {home.knowledge.length === 0 ? (
          <p className="mt-4 text-sm text-ink-dim">No knowledge items yet.</p>
        ) : (
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {home.knowledge.slice(0, 12).map((k) => (
              <li key={k.id} className="rounded-xl border border-line px-3 py-2.5 text-sm">
                <span className="font-mono text-[10px] uppercase text-ink-faint">{k.type}</span>
                <div className="mt-0.5 text-ink">{k.title}</div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Simulation lineages */}
      <section>
        <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-faint">
          Simulations
        </div>
        {lineages.length === 0 ? (
          <p className="mt-4 text-sm text-ink-dim">
            No simulations yet.{" "}
            <Link to="/workspace/simulations?new=1" className="text-chronos">
              Run the engine
            </Link>
            .
          </p>
        ) : (
          <ul className="mt-4 space-y-6">
            {lineages.map((line) => (
              <li key={line.lineage_id} className="border border-line p-4">
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
                          {String(v.result.chosen_future_name ?? v.result.best_future ?? "—")}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ol>
              </li>
            ))}
          </ul>
        )}
      </section>
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

  const a = home.recentSimulations.find((s) => s.id === pickA || s.id === aId);
  const b = home.recentSimulations.find((s) => s.id === pickB || s.id === bId);
  const comparison =
    a && b
      ? compareSimulations(
          a,
          b,
          home.futuresBySimulation[a.id] ?? [],
          home.futuresBySimulation[b.id] ?? []
        )
      : null;

  const apply = (e: React.FormEvent) => {
    e.preventDefault();
    setParams({ a: pickA, b: pickB });
  };

  return (
    <div>
      <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-faint">
        Memory · Compare
      </div>
      <h1 className="mt-2 font-serif text-3xl text-ink">Compare versions</h1>
      <p className="mt-2 max-w-xl text-sm text-ink-dim">
        See how confidence and recommended paths shifted between runs.
      </p>

      <form onSubmit={apply} className="mt-6 flex flex-wrap items-end gap-3">
        <label className="block text-sm">
          <span className="font-mono text-[10px] uppercase text-ink-faint">Left</span>
          <select
            value={pickA}
            onChange={(e) => setPickA(e.target.value)}
            className="mt-1 block rounded-lg border border-line bg-bg px-3 py-2 text-sm text-ink"
          >
            <option value="">Select…</option>
            {home.recentSimulations.map((s) => (
              <option key={s.id} value={s.id}>
                v{s.version} · {s.title}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="font-mono text-[10px] uppercase text-ink-faint">Right</span>
          <select
            value={pickB}
            onChange={(e) => setPickB(e.target.value)}
            className="mt-1 block rounded-lg border border-line bg-bg px-3 py-2 text-sm text-ink"
          >
            <option value="">Select…</option>
            {home.recentSimulations.map((s) => (
              <option key={s.id} value={s.id}>
                v{s.version} · {s.title}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          className="rounded-full bg-ink px-4 py-2 text-sm text-bg hover:bg-chronos"
        >
          Compare
        </button>
      </form>

      {comparison && (
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <CompareSide
            label="Left"
            sim={comparison.left}
            best={comparison.bestFutureLeft}
          />
          <CompareSide
            label="Right"
            sim={comparison.right}
            best={comparison.bestFutureRight}
          />
          <div className="sm:col-span-2 rounded-2xl border border-line px-4 py-4 text-sm text-ink-dim">
            Confidence delta:{" "}
            <span className="font-mono text-chronos">
              {comparison.confidenceDelta == null
                ? "—"
                : `${(comparison.confidenceDelta * 100).toFixed(0)} pts`}
            </span>
            {" · "}
            Best path changed:{" "}
            <span className="text-ink">{comparison.bestFutureChanged ? "Yes" : "No"}</span>
            {" · "}
            Same lineage:{" "}
            <span className="text-ink">{comparison.sameLineage ? "Yes" : "No"}</span>
          </div>
        </div>
      )}

      <Link
        to="/workspace/memory"
        className="mt-8 inline-flex font-mono text-[11px] uppercase tracking-[0.16em] text-ink-dim hover:text-chronos"
      >
        ← Memory
      </Link>
    </div>
  );
}

function CompareSide({
  label,
  sim,
  best,
}: {
  label: string;
  sim: { title: string; version: number; confidence: number | null; created_at: string };
  best: string;
}) {
  return (
    <div className="rounded-2xl border border-line p-4">
      <div className="font-mono text-[10px] uppercase text-ink-faint">{label}</div>
      <div className="mt-1 text-lg text-ink">{sim.title}</div>
      <p className="mt-2 text-sm text-ink-dim">
        v{sim.version} · {confidencePercent(sim.confidence)} · {formatCreatedAt(sim.created_at)}
      </p>
      <p className="mt-3 text-sm">
        Best path: <span className="text-chronos">{best}</span>
      </p>
    </div>
  );
}
