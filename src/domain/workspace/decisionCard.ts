import { buildDecisionReport } from "./decisionReport";
import type { SimulationRecord, WorkspaceHome } from "./types";

/**
 * Decision Card — HQ hero model.
 * Awareness only: CTAs deep-link to sim detail. Never commits chooseBestPath.
 */

export type DecisionCardStatus =
  | "needs_simulation"
  | "running"
  | "failed"
  | "pending_decision"
  | "path_saved"
  | "outcome_due"
  | "complete";

export type DecisionCardModel = {
  decisionTitle: string;
  recommendation: string | null;
  confidence: number | null;
  reason: string | null;
  status: DecisionCardStatus;
  statusLabel: string;
  primaryCtaLabel: string;
  primaryCtaHref: string;
  /** Optional secondary deep-link (e.g. compare on sim detail). */
  secondaryCtaLabel: string | null;
  secondaryCtaHref: string | null;
  simulationId: string | null;
  pathSaved: boolean;
  /** True if primary CTA is a review deep-link, never a commit action. */
  commitsDecision: false;
};

function latestSimulation(home: WorkspaceHome): SimulationRecord | null {
  return home.recentSimulations[0] ?? null;
}

function latestCompleted(home: WorkspaceHome): SimulationRecord | null {
  return home.recentSimulations.find((s) => s.status === "completed") ?? null;
}

function simHref(id: string, hash?: string): string {
  const base = `/workspace/simulations/${id}`;
  return hash ? `${base}${hash}` : base;
}

/**
 * Derive HQ Decision Card from workspace home.
 * Primary CTA always navigates — never mutates path selection.
 */
export function deriveDecisionCard(home: WorkspaceHome): DecisionCardModel {
  const decisionTitle = home.goal?.title?.trim() || home.workspace.name || "Current decision";
  const latest = latestSimulation(home);
  const completed = latestCompleted(home);

  // Prefer latest if running/failed for status; recommendation from completed
  if (latest?.status === "running" || latest?.status === "queued") {
    return {
      decisionTitle,
      recommendation: null,
      confidence: null,
      reason: "Simulation in progress.",
      status: "running",
      statusLabel: "Simulation in progress",
      primaryCtaLabel: "Open simulation →",
      primaryCtaHref: simHref(latest.id),
      secondaryCtaLabel: null,
      secondaryCtaHref: null,
      simulationId: latest.id,
      pathSaved: false,
      commitsDecision: false,
    };
  }

  if (latest?.status === "failed") {
    return {
      decisionTitle,
      recommendation: null,
      confidence: null,
      reason: "Last run failed — re-run or open details.",
      status: "failed",
      statusLabel: "Simulation failed",
      primaryCtaLabel: "Review failed run →",
      primaryCtaHref: simHref(latest.id),
      secondaryCtaLabel: "Run simulation →",
      secondaryCtaHref: "/workspace/simulations?new=1",
      simulationId: latest.id,
      pathSaved: false,
      commitsDecision: false,
    };
  }

  if (!completed) {
    return {
      decisionTitle,
      recommendation: null,
      confidence: null,
      reason: "Run a simulation to produce a recommendation.",
      status: "needs_simulation",
      statusLabel: "No simulation yet",
      primaryCtaLabel: "Run simulation →",
      primaryCtaHref: "/workspace/simulations?new=1",
      secondaryCtaLabel: null,
      secondaryCtaHref: null,
      simulationId: null,
      pathSaved: false,
      commitsDecision: false,
    };
  }

  const futures = home.futuresBySimulation[completed.id] ?? [];
  const report = buildDecisionReport(home, completed, futures);
  const pathSaved = report.pathSaved;
  const followed = report.outcomeFollowed;
  const hasResult = Boolean(report.outcomeResult?.trim());

  let status: DecisionCardStatus;
  if (pathSaved && followed && hasResult) {
    status = "complete";
  } else if (pathSaved && (!followed || !hasResult)) {
    // Path saved but outcome incomplete
    status = followed && !hasResult ? "outcome_due" : "path_saved";
  } else {
    status = "pending_decision";
  }

  const recommendation = report.recommended !== "—" ? report.recommended : null;
  const confidence = report.confidence > 0 ? report.confidence : completed.confidence;
  const reason = report.recommendedBecause[0] ?? report.why[0] ?? report.recommendedSummary ?? null;

  const base = {
    decisionTitle,
    recommendation,
    confidence,
    reason,
    simulationId: completed.id,
    pathSaved,
    commitsDecision: false as const,
    secondaryCtaLabel: "Compare alternatives →" as string | null,
    secondaryCtaHref: simHref(completed.id, "#compare-alternatives") as string | null,
  };

  if (status === "pending_decision") {
    return {
      ...base,
      status,
      statusLabel: "Pending decision",
      primaryCtaLabel: "Review Recommendation →",
      primaryCtaHref: simHref(completed.id),
    };
  }

  if (status === "path_saved") {
    return {
      ...base,
      status,
      statusLabel: "Path saved",
      primaryCtaLabel: "Log outcome →",
      primaryCtaHref: simHref(completed.id),
      secondaryCtaLabel: "Open Decision Report →",
      secondaryCtaHref: simHref(completed.id),
    };
  }

  if (status === "outcome_due") {
    return {
      ...base,
      status,
      statusLabel: "Outcome due",
      primaryCtaLabel: "Finish outcome →",
      primaryCtaHref: simHref(completed.id),
      secondaryCtaLabel: "Open Decision Report →",
      secondaryCtaHref: simHref(completed.id),
    };
  }

  // complete
  return {
    ...base,
    status: "complete",
    statusLabel: "Decision complete",
    primaryCtaLabel: "Open Decision Report →",
    primaryCtaHref: simHref(completed.id),
    secondaryCtaLabel: "Run again →",
    secondaryCtaHref: "/workspace/simulations?new=1",
  };
}
