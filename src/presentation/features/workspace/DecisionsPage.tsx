import { useMemo } from "react";
import { Link } from "react-router-dom";
import type { DecisionStatus, DecisionWithVersions } from "../../../domain/workspace/decision";
import { groupDecisionsWithVersions } from "../../../domain/workspace/decision";
import { confidencePercent, formatCreatedAt } from "../../../domain/workspace/seed";
import { SurfaceLoading } from "./SurfaceLoading";
import { useWorkspace } from "./WorkspaceContext";

/**
 * The decision registry — the question, with its runs underneath.
 *
 * `/workspace/simulations` lists runs by time, which is the right shape for
 * "what did I do recently" and the wrong one for "what have I decided": a
 * re-run appears there as a second, unrelated row. Here a re-run is v2 of the
 * same question, which is what it actually is.
 *
 * Status is derived from the versions on every render, never read from a
 * column — see `deriveDecisionStatus`.
 */
export function DecisionsPage() {
  const { home } = useWorkspace();
  const groups = useMemo(() => (home ? groupDecisionsWithVersions(home) : []), [home]);

  if (!home) return <SurfaceLoading eyebrow="Decision registry" title="Decisions" size="md" />;

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-faint">
            Decision registry
          </div>
          <h1 className="mt-2 font-serif text-3xl text-ink">Decisions</h1>
          <p className="mt-2 max-w-xl text-sm text-ink-dim">
            A decision is the question. Each simulation is one attempt at answering it — re-running
            adds a version rather than starting over.
          </p>
        </div>
        <Link
          to="/workspace/simulations?new=1"
          className="rounded-full bg-ink px-4 py-2 text-sm font-medium text-bg transition hover:bg-chronos"
        >
          Open a decision
        </Link>
      </div>

      {groups.length === 0 ? (
        <section className="mt-8 rounded-2xl border border-dashed border-line px-5 py-8">
          <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-faint">
            No decisions yet
          </div>
          <p className="mt-3 max-w-xl text-sm text-ink-dim">
            Run a simulation and the question it answers is registered here, with every re-run filed
            underneath it as a new version.
          </p>
        </section>
      ) : (
        <ul className="mt-8 space-y-4" data-testid="decision-registry">
          {groups.map((group) => (
            <DecisionRow key={group.decision.id} group={group} />
          ))}
        </ul>
      )}
    </div>
  );
}

function DecisionRow({ group }: { group: DecisionWithVersions }) {
  const { decision, versions, latest, status } = group;

  return (
    <li className="rounded-2xl border border-line" data-testid="decision-row">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4">
        <div className="min-w-0">
          <Link
            to={`/workspace/simulations/${latest.id}`}
            className="font-serif text-xl text-ink transition hover:text-chronos"
          >
            {decision.title}
          </Link>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-ink-faint">
            <StatusPill status={status} />
            <span data-testid="decision-version-count">
              {versions.length} {versions.length === 1 ? "version" : "versions"}
            </span>
            <span>opened {formatCreatedAt(decision.created_at)}</span>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="font-mono text-sm text-chronos">
            {confidencePercent(latest.confidence)}
          </div>
          <div className="mt-0.5 text-xs text-ink-faint">latest</div>
        </div>
      </div>

      <ul className="divide-y divide-line">
        {versions.map((version) => (
          <li key={version.id}>
            <Link
              to={`/workspace/simulations/${version.id}`}
              className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 transition hover:bg-bg-soft/40"
            >
              <div className="flex min-w-0 flex-wrap items-center gap-2.5">
                <span className="rounded-full bg-chronos/15 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-chronos">
                  v{version.version}
                </span>
                <span className="truncate text-sm text-ink">{version.title}</span>
                {version.result.chosen_future_name ? (
                  <span className="text-xs text-chronos">
                    Path: {String(version.result.chosen_future_name)}
                  </span>
                ) : null}
              </div>
              <span className="shrink-0 text-xs text-ink-faint">
                {formatCreatedAt(version.created_at)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </li>
  );
}

const STATUS_LABEL: Record<DecisionStatus, string> = {
  open: "open",
  decided: "decided",
  executed: "executed",
};

function StatusPill({ status }: { status: DecisionStatus }) {
  const tone =
    status === "executed"
      ? "bg-chronos/15 text-chronos"
      : status === "decided"
        ? "bg-accent-2/15 text-accent-2"
        : "bg-bg text-ink-dim";
  return (
    <span
      className={`rounded-full px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] ${tone}`}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}
