import { useMemo } from "react";
import { Link } from "react-router-dom";
import { evaluateBetaChecklist } from "../../../domain/workspace/betaChecklist";
import { deriveDecisionCard } from "../../../domain/workspace/decisionCard";
import { decisionHistoryPreview } from "../../../domain/workspace/decisionHistory";
import { formatRelativeTime } from "../../../domain/workspace/pulse";
import { confidencePercent, formatCreatedAt } from "../../../domain/workspace/seed";
import { useWorkspace } from "../workspace/WorkspaceContext";
import { BetaChecklist } from "./components/BetaChecklist";
import { DecisionCardView } from "./components/DecisionCard";
import { HqPipeline } from "./components/HqPipeline";

/**
 * Decision Workspace HQ
 * Desktop: public/image.png · Mobile: public/mobile.png
 */
export function DashboardPage() {
  const { home, preferences } = useWorkspace();
  if (!home?.goal) return null;

  const card = useMemo(() => deriveDecisionCard(home), [home]);
  const latest = home.recentSimulations[0] ?? null;
  const completed = home.recentSimulations.filter((s) => s.status === "completed");
  const futures =
    card.simulationId != null
      ? (home.futuresBySimulation[card.simulationId] ?? []).slice(0, 5)
      : [];
  const activity = decisionHistoryPreview(home, 6);
  const evidence = [
    ...home.knowledge,
    ...home.notes.map((n) => ({
      id: n.id,
      title: n.title,
      type: "note" as const,
      created_at: n.created_at,
    })),
  ].slice(0, 6);

  const checklist = useMemo(
    () => evaluateBetaChecklist(home, preferences),
    [home, preferences]
  );
  const checklistOpen = checklist.some((item) => !item.done && !item.optional);

  const confLabel =
    card.confidence == null
      ? "—"
      : card.confidence >= 0.7
        ? "High confidence"
        : card.confidence >= 0.45
          ? "Moderate confidence"
          : "Low confidence";

  const statusDot =
    latest?.status === "running" || latest?.status === "queued"
      ? "bg-amber-400"
      : latest?.status === "completed"
        ? "bg-chronos"
        : "bg-chronos";

  return (
    <div className="ws-cascade mx-auto max-w-5xl space-y-4 sm:space-y-5">
      {/* Desktop lifecycle strip only — mobile mock stacks content */}
      <div className="hidden sm:block">
        <HqPipeline latest={latest} />
      </div>

      {checklistOpen && <BetaChecklist items={checklist} />}

      {/* Mobile status row (mock: CURRENT DECISION · Planning) */}
      <div className="flex items-center justify-between gap-2 sm:hidden">
        <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-faint">
          Current decision
        </div>
        <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase text-chronos">
          <span className={`inline-flex h-1.5 w-1.5 rounded-full ${statusDot}`} />
          {card.statusLabel}
        </div>
      </div>

      {/* Decision header + confidence */}
      <div className="grid gap-4 lg:grid-cols-[1fr_220px]">
        <section className="min-w-0">
          <div className="hidden font-mono text-[10px] uppercase tracking-[0.2em] text-ink-faint sm:block">
            Decision
          </div>
          <h1 className="font-serif text-[1.75rem] leading-tight text-ink sm:mt-2 sm:text-3xl lg:text-4xl">
            {card.decisionTitle}
          </h1>
          {home.goal.description ? (
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-dim">
              {home.goal.description}
            </p>
          ) : (
            <p className="mt-2 max-w-2xl text-sm text-ink-dim">
              Define the best path forward — simulate futures, rank outcomes, and
              collapse to a recommendation.
            </p>
          )}
          <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 font-mono text-[10px] uppercase tracking-[0.08em] text-ink-faint">
            <span>{formatCreatedAt(home.goal.created_at)}</span>
            <span className="hidden sm:inline">·</span>
            <span className="hidden sm:inline">{card.statusLabel}</span>
            <span className="hidden sm:inline">·</span>
            <span className="hidden sm:inline">{home.workspace.name}</span>
          </div>
        </section>

        <section className="rounded-2xl border border-line bg-bg-soft/20 p-4">
          <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint">
            Decision confidence
          </div>
          <div className="mt-2 flex items-end justify-between gap-3">
            <div>
              <div className="font-mono text-4xl tabular-nums text-chronos">
                {card.confidence != null ? confidencePercent(card.confidence) : "—"}
              </div>
              <div className="mt-1 text-xs text-ink-dim">{confLabel}</div>
            </div>
            {/* Decorative sparkline placeholder */}
            <svg
              width="72"
              height="28"
              viewBox="0 0 72 28"
              className="mb-1 opacity-70"
              aria-hidden
            >
              <path
                d="M1 22 C12 20 14 8 24 10 C34 12 36 18 46 14 C56 10 60 6 71 4"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                className="text-chronos"
              />
            </svg>
          </div>
          <dl className="mt-4 grid grid-cols-3 gap-2 border-t border-line pt-3 font-mono text-[10px] uppercase text-ink-faint sm:grid-cols-1 sm:space-y-1.5 sm:gap-0">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:gap-2">
              <dt>Evidence</dt>
              <dd className="text-ink-dim">
                {home.knowledge.length + home.notes.length}
              </dd>
            </div>
            <div className="flex flex-col sm:flex-row sm:justify-between sm:gap-2">
              <dt>Sims</dt>
              <dd className="text-ink-dim">{home.recentSimulations.length}</dd>
            </div>
            <div className="flex flex-col sm:flex-row sm:justify-between sm:gap-2">
              <dt>Done</dt>
              <dd className="text-ink-dim">{completed.length}</dd>
            </div>
          </dl>
        </section>
      </div>

      {/* Recommendation | Evidence (evidence desktop/tablet) */}
      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <DecisionCardView card={card} />

        <section className="hidden rounded-2xl border border-line bg-bg-soft/15 p-5 sm:block">
          <div className="flex items-center justify-between gap-2">
            <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-faint">
              Evidence
            </div>
            <Link
              to="/workspace/knowledge"
              className="font-mono text-[10px] uppercase text-chronos"
            >
              View all
            </Link>
          </div>
          {evidence.length === 0 ? (
            <p className="mt-4 text-sm text-ink-dim">
              Add knowledge to ground simulations.{" "}
              <Link to="/workspace/knowledge" className="text-chronos">
                Open library →
              </Link>
            </p>
          ) : (
            <ul className="mt-4 space-y-2">
              {evidence.map((item) => (
                <li
                  key={item.id}
                  className="flex items-center justify-between gap-2 rounded-xl border border-line/70 px-3 py-2.5 text-sm"
                >
                  <span className="min-w-0 truncate text-ink">{item.title}</span>
                  <span className="shrink-0 font-mono text-[10px] uppercase text-ink-faint">
                    {item.type}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Ranked futures | Activity */}
      <div className="grid gap-4 lg:grid-cols-2">
        <section
          data-testid="ranked-futures-hq"
          className="rounded-2xl border border-line p-5"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-faint">
              Ranked futures ({futures.length})
            </div>
            {card.simulationId ? (
              <Link
                to={`/workspace/simulations/${card.simulationId}`}
                className="font-mono text-[10px] uppercase text-chronos"
              >
                Open sim →
              </Link>
            ) : null}
          </div>
          {futures.length === 0 ? (
            <div className="mt-8 text-center">
              <p className="text-sm text-ink-dim">No simulations yet</p>
              <p className="mt-1 text-xs text-ink-faint">
                Simulate different paths to explore outcomes.
              </p>
              <Link
                to="/workspace/simulations?new=1"
                className="mt-4 inline-flex rounded-full border border-line bg-ink/5 px-4 py-2.5 text-sm text-ink transition hover:border-chronos/50 hover:text-chronos"
              >
                Run your first simulation →
              </Link>
            </div>
          ) : (
            <ol className="mt-4 space-y-2">
              {futures.map((f, i) => (
                <li
                  key={f.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-line/80 px-3 py-2.5 text-sm"
                >
                  <div className="min-w-0">
                    <span className="font-mono text-[10px] text-ink-faint">#{i + 1}</span>
                    <span className="ml-2 text-ink">{f.name}</span>
                  </div>
                  <span className="shrink-0 font-mono text-[11px] text-chronos">
                    {confidencePercent(f.score)}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section
          data-testid="decision-timeline-preview"
          className="rounded-2xl border border-line p-5"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-faint">
              Recent activity
            </div>
            <Link
              to="/workspace/timeline"
              className="font-mono text-[10px] uppercase text-chronos"
            >
              View all
            </Link>
          </div>
          {activity.length === 0 ? (
            <p className="mt-4 text-sm text-ink-dim">No decision events yet.</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {activity.map((e) => (
                <li
                  key={e.id}
                  className="flex items-start justify-between gap-3 text-sm"
                >
                  <span className="text-ink">• {e.label}</span>
                  <span className="shrink-0 font-mono text-[10px] uppercase text-ink-faint">
                    {formatRelativeTime(e.at)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section
        data-testid="recent-simulations"
        className="hidden rounded-2xl border border-line p-5 sm:block"
      >
        <div className="flex items-center justify-between gap-2">
          <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-faint">
            Recent simulations
          </div>
          <Link
            to="/workspace/simulations"
            className="font-mono text-[10px] uppercase text-chronos"
          >
            All →
          </Link>
        </div>
        {home.recentSimulations.length === 0 ? (
          <p className="mt-3 text-sm text-ink-dim">No runs yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-line">
            {home.recentSimulations.slice(0, 4).map((s) => (
              <li key={s.id}>
                <Link
                  to={`/workspace/simulations/${s.id}`}
                  className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm hover:text-chronos"
                >
                  <span className="text-ink">{s.title}</span>
                  <span className="font-mono text-[10px] uppercase text-ink-faint">
                    {s.status}
                    {s.confidence != null
                      ? ` · ${confidencePercent(s.confidence)}`
                      : ""}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
