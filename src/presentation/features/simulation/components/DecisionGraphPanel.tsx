import {
  compareBranches,
  describeDecisionGraph,
  type BranchCompareRow,
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

function formatDelta(value: number, kind: "score" | "risk"): string {
  if (Math.abs(value) < 0.005) return kind === "score" ? "Best EV" : "Baseline risk";
  const sign = value > 0 ? "+" : "";
  if (kind === "score") return `${sign}${value.toFixed(2)} vs best`;
  // risk: lower is better
  if (value < 0) return `${Math.abs(value * 100).toFixed(0)}pp safer`;
  return `+${(value * 100).toFixed(0)}pp risk`;
}

function BranchCompareCard({
  row,
  active,
  onSelect,
}: {
  row: BranchCompareRow;
  active: boolean;
  onSelect?: () => void;
}) {
  const body = (
    <>
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-faint">
          #{row.rank}
          {row.recommended ? " · Best" : " · Alt"}
          {row.chosen ? " · Chosen" : ""}
        </span>
        <span className="font-mono text-sm text-chronos">{confidencePercent(row.confidence)}</span>
      </div>
      <div className="mt-1.5 text-[15px] font-medium leading-snug text-ink">{row.name}</div>
      {row.summary ? (
        <p className="mt-1.5 line-clamp-2 text-[12px] leading-relaxed text-ink-dim">
          {row.summary}
        </p>
      ) : null}
      <div className="mt-3 space-y-1.5">
        <div className="flex items-center justify-between font-mono text-[10px] text-ink-faint">
          <span>Score</span>
          <span className="text-ink">{row.score.toFixed(2)}</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-line/80">
          <div
            className={`h-full rounded-full ${row.recommended ? "bg-chronos" : "bg-chronos/50"}`}
            style={{ width: `${Math.max(4, Math.min(100, row.score * 100))}%` }}
          />
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 font-mono text-[10px] text-ink-faint">
          <span>{formatDelta(row.scoreDelta, "score")}</span>
          <span>Risk {Math.round(row.risk * 100)}%</span>
          <span>{formatDelta(row.riskDelta, "risk")}</span>
        </div>
      </div>
    </>
  );

  const className = `w-full rounded-xl border px-3.5 py-3.5 text-left transition ${
    active
      ? "border-chronos/50 bg-bg/80 ring-1 ring-chronos/40"
      : row.chosen
        ? "border-chronos/35 bg-chronos/5"
        : "border-line bg-bg/40 hover:border-chronos/35"
  }`;

  if (onSelect) {
    return (
      <button
        type="button"
        onClick={onSelect}
        className={className}
        data-testid="graph-branch-card"
      >
        {body}
      </button>
    );
  }
  return (
    <div className={className} data-testid="graph-branch-card">
      {body}
    </div>
  );
}

/**
 * Decision graph surface:
 * Open → peer branches → compare → collapse · Re-branch = stand at open again.
 */
export function DecisionGraphPanel({
  graph,
  selectedFutureId,
  onSelectBranch,
  onRebranch,
  rebranching,
}: Props) {
  const rows = compareBranches(graph);
  const standingAtOpen = graph.activeNodeId === graph.open.id;

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
            data-testid="graph-rebranch"
            disabled={rebranching}
            onClick={onRebranch}
            className="shrink-0 rounded-full border border-chronos/40 bg-chronos/10 px-4 py-2 text-sm font-medium text-chronos transition hover:bg-chronos/20 disabled:opacity-50"
          >
            {rebranching ? "Re-branching…" : "Re-branch from open"}
          </button>
        )}
      </div>

      {/* Structure map */}
      <div
        className="mt-5 rounded-xl border border-line bg-bg/50 px-4 py-4 font-mono text-[12px] leading-relaxed text-ink-dim"
        data-testid="graph-structure"
      >
        <div className={standingAtOpen ? "text-chronos" : "text-ink-dim"}>
          N0 Open · {graph.open.title}
          {standingAtOpen ? "  ← you are here" : ""}
        </div>
        {rows.map((r, i) => (
          <div key={r.nodeId} className="mt-1 pl-4">
            <span className="text-ink-faint">{i === rows.length - 1 ? "└─" : "├─"}</span>{" "}
            <span className={r.recommended || r.chosen ? "text-chronos" : "text-ink"}>
              N1{String.fromCharCode(97 + i)} {r.name}
            </span>
            {r.recommended ? " ★" : ""}
            {r.chosen ? " · collapsed" : ""}
          </div>
        ))}
        {graph.collapsed && (
          <div
            className={`mt-2 ${graph.activeNodeId === graph.collapsed.id ? "text-chronos" : "text-ink"}`}
          >
            N2 Collapsed · {graph.collapsed.title}
            {graph.activeNodeId === graph.collapsed.id ? "  ← you are here" : ""}
          </div>
        )}
        <div className="mt-3 text-[11px] text-ink-faint" data-testid="graph-describe">
          {describeDecisionGraph(graph)}
        </div>
      </div>

      {/* Side-by-side outcomes */}
      <div className="mt-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint">
            Compare outcomes
          </div>
          <p className="text-[11px] text-ink-faint">
            Select a branch to preview · save decision on the report to collapse
          </p>
        </div>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3" data-testid="graph-compare">
          {rows.map((r) => (
            <li key={r.nodeId}>
              <BranchCompareCard
                row={r}
                active={selectedFutureId === r.futureId}
                onSelect={onSelectBranch ? () => onSelectBranch(r.futureId) : undefined}
              />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
