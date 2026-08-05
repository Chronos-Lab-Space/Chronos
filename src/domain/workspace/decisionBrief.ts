import { countCitations } from "./citations";
import type { FutureRecord, KnowledgeRecord, SimulationRecord, WorkspaceHome } from "./types";

/**
 * Decision Brief — editorial, decision-centric read of a workspace.
 * One derivation for the /workspace/decision surface: the six-state decision
 * lifecycle (Draft → Simulating → Evaluating → Collapsed → Observed → Learned),
 * the current recommendation, honest confidence stats, and ranked futures.
 *
 * Never invents data: every number is derived from WorkspaceHome records, and
 * anything the workspace has not produced yet is null / empty.
 */

export type BriefStageId =
  | "draft"
  | "simulating"
  | "evaluating"
  | "collapsed"
  | "observed"
  | "learned";

export type BriefStage = {
  id: BriefStageId;
  label: string;
  sub: string;
  /** ISO timestamp of when this stage was reached, when known. */
  at: string | null;
  state: "past" | "current" | "ahead";
};

export type BriefStat = {
  label: string;
  value: string;
  caption: string;
};

/**
 * Why a future is not the recommendation.
 *
 * `disqualified` is not a low score — SimulationEngine ranks hard-constraint
 * violations last with `score <= 0` and still ships them, so a path scoring
 * zero was ruled out rather than merely beaten.
 */
export type BriefFutureStanding =
  | { kind: "disqualified" }
  | { kind: "behind"; points: number }
  | null;

export type BriefFuture = {
  id: string;
  simulationId: string;
  name: string;
  summary: string;
  scorePct: number;
  riskPct: number;
  recommended: boolean;
  chosen: boolean;
  /** Null for the recommendation itself. */
  standing: BriefFutureStanding;
};

export type BriefEvidence = {
  id: string;
  title: string;
  kind: string;
  addedAt: string;
  /**
   * Completed runs that recorded using this source. The design weighted
   * sources HIGH/MEDIUM, which nothing in the schema backs; use is a number
   * the workspace really kept.
   */
  citedByRuns: number;
};

export type DecisionBrief = {
  workspaceName: string;
  goalTitle: string | null;
  goalDescription: string;
  goalSetAt: string | null;
  stageId: BriefStageId;
  stages: BriefStage[];
  /** Newest simulation regardless of status (drives the stage band). */
  latestSimulation: SimulationRecord | null;
  /** Newest completed simulation (drives recommendation + futures). */
  reportSimulation: SimulationRecord | null;
  confidencePct: number | null;
  recommendation: { headline: string; body: string | null } | null;
  stats: BriefStat[];
  futures: BriefFuture[];
  evidence: BriefEvidence[];
};

const STAGE_ORDER: BriefStageId[] = [
  "draft",
  "simulating",
  "evaluating",
  "collapsed",
  "observed",
  "learned",
];

const STAGE_LABELS: Record<BriefStageId, { label: string; sub: string }> = {
  draft: { label: "Draft", sub: "Define objective" },
  simulating: { label: "Simulating", sub: "Branch futures" },
  evaluating: { label: "Evaluating", sub: "Score & rank" },
  collapsed: { label: "Collapsed", sub: "Commit to one path" },
  observed: { label: "Observed", sub: "Log real outcome" },
  learned: { label: "Learned", sub: "Feeds memory & priors" },
};

function newestCompleted(sims: readonly SimulationRecord[]): SimulationRecord | null {
  return sims.find((s) => s.status === "completed") ?? null;
}

function trimmed(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function deriveStageId(home: WorkspaceHome): BriefStageId {
  const latest = home.recentSimulations[0] ?? null;
  const report = newestCompleted(home.recentSimulations);

  if (latest && (latest.status === "queued" || latest.status === "running")) {
    return "simulating";
  }
  if (!report) return "draft";

  const result = report.result;
  if (trimmed(result.outcome_result)) return "learned";
  if (result.outcome_followed) return "observed";
  if (trimmed(result.chosen_future_id)) return "collapsed";
  return "evaluating";
}

function stageTimestamp(
  id: BriefStageId,
  home: WorkspaceHome,
  report: SimulationRecord | null
): string | null {
  switch (id) {
    case "draft":
      return home.goal?.created_at ?? home.workspace.created_at;
    case "simulating":
      return (home.recentSimulations[0] ?? report)?.created_at ?? null;
    case "evaluating":
      return report?.created_at ?? null;
    case "collapsed":
      return trimmed(report?.result.chosen_at);
    case "observed":
      return trimmed(report?.result.outcome_followed_at);
    case "learned":
      return trimmed(report?.result.outcome_result_at);
  }
}

/**
 * Whole days since the newest attached source, or null when nothing is
 * attached. `now` is a parameter so the value stays testable and the
 * derivation stays pure.
 */
function daysSinceLastInput(home: WorkspaceHome, now: Date): number | null {
  const newest = [...home.knowledge, ...home.notes]
    .map((record) => record.created_at)
    .sort((a, b) => b.localeCompare(a))[0];
  if (!newest) return null;

  const at = new Date(newest).getTime();
  if (Number.isNaN(at)) return null;

  return Math.max(0, Math.floor((now.getTime() - at) / 86_400_000));
}

export function deriveDecisionBrief(
  home: WorkspaceHome | null,
  now: Date = new Date()
): DecisionBrief | null {
  if (!home) return null;

  const goal = home.goal;
  const latest = home.recentSimulations[0] ?? null;
  const report = newestCompleted(home.recentSimulations);
  const stageId = deriveStageId(home);
  const stageIndex = STAGE_ORDER.indexOf(stageId);

  const stages: BriefStage[] = STAGE_ORDER.map((id, i) => ({
    id,
    label: STAGE_LABELS[id].label,
    sub: STAGE_LABELS[id].sub,
    at: i <= stageIndex ? stageTimestamp(id, home, report) : null,
    state: i < stageIndex ? "past" : i === stageIndex ? "current" : "ahead",
  }));

  const futuresRaw = report ? (home.futuresBySimulation[report.id] ?? []) : [];
  const chosenId = trimmed(report?.result.chosen_future_id);
  const bestName = trimmed(report?.result.best_future);
  const ranked = [...futuresRaw].sort((a, b) => b.score - a.score);
  const leadPct = ranked.length ? Math.round(ranked[0].score * 100) : 0;
  const futures: BriefFuture[] = ranked.map((f: FutureRecord, i) => {
    const scorePct = Math.round(f.score * 100);
    const recommended = bestName ? f.name === bestName : i === 0;
    return {
      id: f.id,
      simulationId: f.simulation_id,
      name: f.name,
      summary: f.summary,
      scorePct,
      riskPct: Math.round(f.risk * 100),
      recommended,
      chosen: chosenId === f.id,
      // `recommended` alone is not enough: when best_future names a path that
      // is no longer in the stored futures, nothing is recommended and the
      // top-ranked future would be measured against its own score.
      standing:
        f.score <= 0
          ? { kind: "disqualified" }
          : recommended || i === 0
            ? null
            : { kind: "behind", points: leadPct - scorePct },
    };
  });

  const recommendationText = trimmed(report?.result.recommendation);
  const recommendation =
    report && (recommendationText || bestName)
      ? {
          headline: recommendationText ?? `Collapse to “${bestName}”.`,
          // AI prose when enrichment produced any, the deterministic thesis
          // otherwise — including on every run that predates this field.
          body:
            trimmed(report.result.recommendation_body) ??
            trimmed(report.result.thesis) ??
            trimmed(report.result.chosen_summary),
        }
      : null;

  const confidencePct =
    report && typeof report.confidence === "number" ? Math.round(report.confidence * 100) : null;

  const constraints = Array.isArray(report?.result.constraints)
    ? report.result.constraints.length
    : 0;
  const risks = Array.isArray(report?.result.risks) ? report.result.risks.length : 0;
  const disqualified =
    typeof report?.result.disqualified_count === "number" ? report.result.disqualified_count : 0;
  const staleDays = daysSinceLastInput(home, now);
  const evidenceCount = home.knowledge.length + home.notes.length;

  const stats: BriefStat[] = [
    {
      label: "EVIDENCE",
      value: String(evidenceCount),
      caption: evidenceCount === 1 ? "source attached" : "sources attached",
    },
    {
      label: "SIMULATIONS",
      value: String(home.recentSimulations.length),
      caption: "runs in this workspace",
    },
    { label: "FUTURES", value: String(futures.length), caption: "in the latest report" },
    { label: "CONSTRAINTS", value: String(constraints), caption: "applied to the run" },
    { label: "RISKS", value: String(risks), caption: "identified" },
    // The engine's own count of paths hard constraints removed — the honest
    // version of the design's "dissent": disagreement the run acted on.
    { label: "RULED OUT", value: String(disqualified), caption: "futures hard constraints cut" },
    {
      label: "STALENESS",
      value: staleDays == null ? "—" : staleDays === 0 ? "today" : `${staleDays}d`,
      caption: "since the last source landed",
    },
    {
      label: "VERSION",
      value: report ? `v${report.version}` : "—",
      caption: "of this simulation lineage",
    },
  ];

  const citations = countCitations(home.recentSimulations);
  const evidence: BriefEvidence[] = [
    ...home.knowledge.map((k: KnowledgeRecord) => ({
      id: k.id,
      title: k.title,
      kind: k.type,
      addedAt: k.created_at,
      citedByRuns: citations.get(k.id) ?? 0,
    })),
    ...home.notes.map((n) => ({
      id: n.id,
      title: n.title,
      kind: "note",
      addedAt: n.created_at,
      citedByRuns: citations.get(n.id) ?? 0,
    })),
  ].sort((a, b) => b.addedAt.localeCompare(a.addedAt));

  return {
    workspaceName: home.workspace.name,
    goalTitle: trimmed(goal?.title),
    goalDescription: goal?.description?.trim() ?? "",
    goalSetAt: goal?.created_at ?? null,
    stageId,
    stages,
    latestSimulation: latest,
    reportSimulation: report,
    confidencePct,
    recommendation,
    stats,
    futures,
    evidence,
  };
}
