import {
  compareBranches,
  describeDecisionGraph,
  type DecisionGraph,
} from "../../../../domain/workspace/decisionGraph";
import { confidencePercent } from "../../../../domain/workspace/seed";

type Props = {
  graph: DecisionGraph;
  selectedFutureId?: string | null;
  onSelectBranch?: (futureId: string) => void;
  onRebranch?: () => void;
  rebranching?: boolean;
};

/**
 * Smallest demo-able decision graph:
 * Open → 2–3 branches → optional collapse · Re-branch = roll back to open.
 */
export function DecisionGraphPanel({
  graph,
  selectedFutureId,
  onSelectBranch,
  onRebranch,
  rebranching,
}: Props) {
  const rows = compareBranches(graph);

  return (
    <section
      data-testid="decision-graph-panel"
      className="rounded-2xl border border-chronos/35 bg-gradient-to-b from-chronos/10 to-bg p-5 sm:p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-chronos">
            Decision graph
          </div>
          <p className="mt-1 max-w-xl text-sm text-ink-dim">
            One decision point, peer branches, compare, commit — then re-branch from open. Inside a
            node you can loop; the product is the graph.
          </p>
        </div>
        {onRebranch && (
          <button
            type="button"
            disabled={rebranching}
            onClick={onRebranch}
            className="shrink-0 rounded-full border border-chronos/40 bg-chronos/10 px-4 py-2 text-sm font-medium text-chronos transition hover:bg-chronos/20 disabled:opacity-50"
          >
            {rebranching ? "Re-branching…" : "Re-branch from open"}
          </button>
        )}
      </div>

      {/* ASCII-ish structure */}
      <div className="mt-5 rounded-xl border border-line bg-bg/50 px-4 py-4 font-mono text-[12px] leading-relaxed text-ink-dim">
        <div className="text-chronos">
          N0 Open · {graph.open.title}
          {graph.activeNodeId === graph.open.id ? "  ← active" : ""}
        </div>
        {rows.map((r, i) => (
          <div key={r.nodeId} className="mt-1 pl-4">
            <span className="text-ink-faint">{i === rows.length - 1 ? "└─" : "├─"}</span>{" "}
            <span className={r.recommended ? "text-chronos" : "text-ink"}>
              N1{String.fromCharCode(97 + i)} {r.name}
            </span>
            {r.recommended ? " ★" : ""}
            {r.chosen ? " · collapsed" : ""}
          </div>
        ))}
        {graph.collapsed && (
          <div className="mt-2 text-ink">
            N2 Collapsed · {graph.collapsed.title}
            {graph.activeNodeId === graph.collapsed.id ? "  ← active" : ""}
          </div>
        )}
        <div className="mt-3 text-[11px] text-ink-faint">{describeDecisionGraph(graph)}</div>
      </div>

      {/* Compare outcomes */}
      <div className="mt-5">
        <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint">
          Compare outcomes
        </div>
        <ul className="mt-3 grid gap-2 sm:grid-cols-3">
          {rows.map((r) => {
            const active = selectedFutureId === r.futureId;
            const body = (
              <>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[10px] uppercase text-ink-faint">
                    {r.recommended ? "Best" : "Alt"}
                    {r.chosen ? " · chosen" : ""}
                  </span>
                  <span className="font-mono text-sm text-chronos">
                    {confidencePercent(r.confidence)}
                  </span>
                </div>
                <div className="mt-1 truncate text-[15px] text-ink">{r.name}</div>
                <div className="mt-1 font-mono text-[11px] text-ink-faint">
                  Risk {Math.round(r.risk * 100)}% · Score {r.score.toFixed(2)}
                </div>
              </>
            );
            return (
              <li key={r.nodeId}>
                {onSelectBranch ? (
                  <button
                    type="button"
                    onClick={() => onSelectBranch(r.futureId)}
                    className={`w-full rounded-xl border px-3 py-3 text-left transition ${
                      active
                        ? "border-chronos/50 bg-bg/70 ring-1 ring-chronos/40"
                        : "border-line bg-bg/40 hover:border-chronos/35"
                    }`}
                  >
                    {body}
                  </button>
                ) : (
                  <div className="rounded-xl border border-line bg-bg/40 px-3 py-3">{body}</div>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
