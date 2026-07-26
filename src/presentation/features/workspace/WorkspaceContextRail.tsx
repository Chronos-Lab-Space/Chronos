import { Link } from "react-router-dom";
import { confidencePercent, formatCreatedAt } from "../../../domain/workspace/seed";
import type { WorkspaceHome } from "../../../domain/workspace/types";

/**
 * Right context rail — objective, constraints, related sims, outcome tracking.
 * Matches product HQ mock (docs/images/workspace-desktop-mock.png).
 */
export function WorkspaceContextRail({ home }: { home: WorkspaceHome }) {
  const goal = home.goal;
  const knowledge = home.knowledge.slice(0, 6);
  const related = home.recentSimulations.filter((s) => s.status === "completed").slice(0, 4);
  const latest = home.recentSimulations[0];
  const constraints =
    latest && Array.isArray(latest.result.constraints)
      ? (latest.result.constraints as string[]).slice(0, 6)
      : [];

  return (
    <aside
      className="workspace-context-rail hidden w-[280px] shrink-0 border-l border-line xl:block"
      aria-label="Context"
    >
      <div className="sticky top-14 flex h-[calc(100dvh-3.5rem)] flex-col overflow-y-auto p-4">
        <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-faint">
          Context
        </div>
        <div className="mt-3 flex gap-1 border-b border-line pb-2">
          <span className="rounded-md bg-chronos/15 px-2.5 py-1 font-mono text-[10px] uppercase text-chronos">
            Details
          </span>
          <Link
            to="/workspace/knowledge"
            className="rounded-md px-2.5 py-1 font-mono text-[10px] uppercase text-ink-faint hover:text-ink"
          >
            Notes
          </Link>
        </div>

        <section className="mt-4">
          <div className="flex items-center justify-between">
            <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint">
              Objective
            </div>
            <Link to="/workspace" className="font-mono text-[10px] text-chronos">
              Update
            </Link>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-ink-dim">
            {goal?.description?.trim() || goal?.title || "No objective set."}
          </p>
        </section>

        <section className="mt-5">
          <div className="flex items-center justify-between">
            <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint">
              Constraints
            </div>
            <Link to="/workspace/simulations?new=1" className="font-mono text-[10px] text-chronos">
              Edit
            </Link>
          </div>
          {constraints.length === 0 ? (
            <p className="mt-2 text-sm text-ink-faint">None on latest run.</p>
          ) : (
            <ul className="mt-2 space-y-1.5 text-sm text-ink-dim">
              {constraints.map((c) => (
                <li key={c} className="flex gap-2">
                  <span className="text-chronos">•</span>
                  <span>{c.replace(/^(hard|soft):\s*/i, "")}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mt-5">
          <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint">
            Knowledge pulse
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <div className="rounded-xl border border-line bg-bg-soft/20 px-3 py-2">
              <div className="font-mono text-[10px] text-ink-faint">Sources</div>
              <div className="mt-0.5 font-mono text-lg text-chronos">
                {home.knowledge.length + home.notes.length}
              </div>
            </div>
            <div className="rounded-xl border border-line bg-bg-soft/20 px-3 py-2">
              <div className="font-mono text-[10px] text-ink-faint">Sims</div>
              <div className="mt-0.5 font-mono text-lg text-chronos">
                {home.recentSimulations.length}
              </div>
            </div>
          </div>
          {knowledge.length > 0 ? (
            <ul className="mt-3 space-y-1.5">
              {knowledge.slice(0, 3).map((k) => (
                <li key={k.id} className="truncate text-xs text-ink-dim">
                  {k.title}
                </li>
              ))}
            </ul>
          ) : null}
        </section>

        <section className="mt-5">
          <div className="flex items-center justify-between">
            <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint">
              Related simulations
            </div>
            <Link to="/workspace/simulations" className="font-mono text-[10px] text-chronos">
              View all →
            </Link>
          </div>
          {related.length === 0 ? (
            <p className="mt-2 text-sm text-ink-faint">No completed runs yet.</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {related.map((s) => (
                <li key={s.id}>
                  <Link
                    to={`/workspace/simulations/${s.id}`}
                    className="flex items-center justify-between gap-2 rounded-lg border border-line/80 px-2.5 py-2 text-xs transition hover:border-chronos/40"
                  >
                    <span className="min-w-0 truncate text-ink">{s.title}</span>
                    <span className="shrink-0 font-mono text-[10px] text-chronos">
                      {s.confidence != null ? confidencePercent(s.confidence) : "—"}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mt-auto border-t border-line pt-4">
          <div className="flex items-center justify-between">
            <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint">
              Outcome tracking
            </div>
            <span className="rounded-full border border-line px-2 py-0.5 font-mono text-[9px] uppercase text-ink-faint">
              {latest?.result.outcome_followed ? "In progress" : "Not started"}
            </span>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-ink-dim">
            Track real-world outcome once a path is chosen to improve future recommendations.
          </p>
          {latest ? (
            <Link
              to={`/workspace/simulations/${latest.id}`}
              className="mt-3 inline-flex rounded-full border border-line px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-dim transition hover:border-chronos/40 hover:text-chronos"
            >
              Log outcome
            </Link>
          ) : null}
          {latest ? (
            <p className="mt-2 font-mono text-[10px] text-ink-faint">
              Latest {formatCreatedAt(latest.created_at)}
            </p>
          ) : null}
        </section>
      </div>
    </aside>
  );
}
