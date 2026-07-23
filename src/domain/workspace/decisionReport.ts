import {
  deriveFutureHooks,
  futureCardLabel,
  type FutureHookLabel,
} from "./timeline";
import {
  deriveTradeoffs,
  resolveKnowledgeUsed,
  type KnowledgeUsedRef,
  type TradeoffRow,
} from "./simulationReport";
import {
  buildDecisionEvidence,
  type DecisionEvidence,
} from "./evidence";
import {
  deriveExpectedValue,
  type ExpectedValueResult,
} from "./expectedValue";
import type {
  FutureRecord,
  GoalRecord,
  OutcomeFollowed,
  SimulationRecord,
  WorkspaceHome,
} from "./types";

/**
 * Decision Report — the keepable product artifact.
 *
 * Contract: Goal → Summary → Evidence → Recommendation → Why →
 * Expected Value → Compare → Next → Save Decision → Memory
 */
export type DecisionReportAlternative = {
  id: string;
  label: string;
  name: string;
  confidence: number;
  risk: number;
  score: number;
  summary: string;
  hook: FutureHookLabel | null;
  isRecommended: boolean;
};

export type SimulationSummary = {
  pathsEvaluated: number | null;
  strategiesGenerated: number;
  disqualifiedCount: number | null;
  status: string;
};

export type DecisionReport = {
  /** Active decision / goal title */
  decisionTitle: string;
  /** Simulation objective (what Chronos decided) */
  objective: string;
  objectiveDescription: string | null;
  summary: SimulationSummary;
  evidence: DecisionEvidence;
  contextUsed: KnowledgeUsedRef[];
  alternatives: DecisionReportAlternative[];
  tradeoffs: TradeoffRow[];
  confidence: number; // 0–1
  recommended: string;
  recommendedSummary: string | null;
  /**
   * Trust bullets — short, scannable reasons shown as “Recommended because:”
   * e.g. lowest execution risk · fits your stated objective · highest expected success
   */
  recommendedBecause: string[];
  /** Longer narrative / evidence reasons (complementary to recommendedBecause). */
  why: string[];
  expectedValue: ExpectedValueResult;
  risks: string[];
  nextActions: string[];
  simulationId: string;
  simulationTitle: string;
  chosenFutureId: string | null;
  engineBest: string | null;
  pathSaved: boolean;
  outcomeFollowed: OutcomeFollowed | null;
  outcomeFollowedAt: string | null;
  outcomeResult: string | null;
  outcomeResultAt: string | null;
};

export function buildDecisionReport(
  home: WorkspaceHome,
  simulation: SimulationRecord,
  futures: readonly FutureRecord[] = home.futuresBySimulation[simulation.id] ?? []
): DecisionReport {
  const goal = home.goal;
  const chosenId =
    typeof simulation.result.chosen_future_id === "string"
      ? simulation.result.chosen_future_id
      : null;
  const chosen =
    (chosenId ? futures.find((f) => f.id === chosenId) : null) ??
    futures[0] ??
    null;

  const recommended =
    (typeof simulation.result.chosen_future_name === "string" &&
      simulation.result.chosen_future_name) ||
    chosen?.name ||
    (typeof simulation.result.best_future === "string" && simulation.result.best_future) ||
    "—";

  const confidence =
    chosen?.confidence ??
    (simulation.confidence != null ? simulation.confidence : 0);

  const risks = resolveRisks(simulation, chosen);
  const recommendedBecause = deriveRecommendedBecause(
    chosen,
    futures,
    goal,
    simulation,
    home
  );
  const why = deriveWhyReasons(simulation, chosen, goal, home);
  const nextActions = deriveNextActions(simulation, chosen, risks);
  const hooks = deriveFutureHooks(futures);
  const tradeoffs = deriveTradeoffs(futures);
  const contextUsed = resolveKnowledgeUsed(simulation, home);

  const alternatives: DecisionReportAlternative[] = futures.map((f, index) => ({
    id: f.id,
    label: futureCardLabel(index),
    name: f.name,
    confidence: f.confidence,
    risk: f.risk,
    score: f.score,
    summary: f.summary,
    hook: hooks.get(f.id) ?? null,
    isRecommended: f.name === recommended || f.id === chosen?.id,
  }));

  const objectiveDescription =
    (typeof simulation.result.goal_description === "string" &&
      simulation.result.goal_description) ||
    goal?.description ||
    null;

  const evidence = buildDecisionEvidence(home, simulation, futures);
  const knowledgeCount =
    evidence.knowledgeSourcesUsed || home.knowledge.length + home.notes.length;
  const expectedValue = deriveExpectedValue({
    chosen,
    futures,
    simulation,
    knowledgeCount,
    constraintCount: evidence.constraintsEvaluated,
  });

  const pathsEvaluated =
    typeof simulation.result.paths_evaluated === "number"
      ? simulation.result.paths_evaluated
      : null;
  const disqualifiedCount =
    typeof simulation.result.disqualified_count === "number"
      ? simulation.result.disqualified_count
      : null;

  return {
    decisionTitle: goal?.title?.trim() || simulation.title,
    objective:
      (typeof simulation.result.goal_title === "string" && simulation.result.goal_title) ||
      goal?.title?.trim() ||
      simulation.title,
    objectiveDescription,
    summary: {
      pathsEvaluated,
      strategiesGenerated: evidence.strategiesGenerated,
      disqualifiedCount,
      status: simulation.status,
    },
    evidence,
    contextUsed,
    alternatives,
    tradeoffs,
    confidence: Math.max(0, Math.min(1, confidence)),
    recommended,
    recommendedSummary: chosen?.summary ?? null,
    recommendedBecause,
    why,
    expectedValue,
    risks,
    nextActions,
    simulationId: simulation.id,
    simulationTitle: simulation.title,
    chosenFutureId: chosenId,
    engineBest:
      typeof simulation.result.best_future === "string"
        ? simulation.result.best_future
        : futures[0]?.name ?? null,
    pathSaved: Boolean(chosenId),
    outcomeFollowed: parseOutcomeFollowed(simulation.result.outcome_followed),
    outcomeFollowedAt:
      typeof simulation.result.outcome_followed_at === "string"
        ? simulation.result.outcome_followed_at
        : null,
    outcomeResult:
      typeof simulation.result.outcome_result === "string"
        ? simulation.result.outcome_result
        : null,
    outcomeResultAt:
      typeof simulation.result.outcome_result_at === "string"
        ? simulation.result.outcome_result_at
        : null,
  };
}

/**
 * Transparent “Recommended because:” bullets.
 * Every recommendation must explain why — short, comparable, trust-building.
 */
export function deriveRecommendedBecause(
  chosen: FutureRecord | null,
  futures: readonly FutureRecord[],
  goal: GoalRecord | null,
  simulation: SimulationRecord,
  home?: WorkspaceHome
): string[] {
  const reasons: string[] = [];
  if (!chosen) {
    return ["engine-ranked path for this objective"];
  }

  const peers = futures.filter((f) => f.id !== chosen.id);
  const minRisk = Math.min(...futures.map((f) => f.risk));
  const maxScore = Math.max(...futures.map((f) => f.score));
  const maxConf = Math.max(...futures.map((f) => f.confidence));

  // lowest execution risk
  if (futures.length === 1 || chosen.risk <= minRisk + 0.001) {
    reasons.push("lowest execution risk");
  } else if (chosen.risk <= 0.35) {
    reasons.push("low execution risk relative to alternatives");
  } else if (peers.some((p) => p.risk > chosen.risk + 0.05)) {
    reasons.push("lower execution risk than higher-upside alternatives");
  }

  // fits stated objective
  if (goal?.title?.trim()) {
    reasons.push("fits your stated objective");
  } else if (simulation.title?.trim()) {
    reasons.push("fits the simulation objective");
  }

  // fewer dependencies (heuristic from path language)
  const depLoad = (f: FutureRecord) => dependencyLoad(f);
  const chosenDeps = depLoad(chosen);
  if (
    futures.length === 1 ||
    peers.every((p) => chosenDeps <= depLoad(p))
  ) {
    reasons.push("requires fewer dependencies");
  } else if (chosenDeps < average(peers.map(depLoad))) {
    reasons.push("requires fewer dependencies than average alternatives");
  }

  // highest expected success (score) / confidence
  if (futures.length === 1 || chosen.score >= maxScore - 0.001) {
    reasons.push("highest expected success");
  } else if (chosen.confidence >= maxConf - 0.001) {
    reasons.push("highest confidence among ranked futures");
  } else if (chosen.score >= maxScore - 0.08) {
    reasons.push("among the highest expected success paths");
  }

  // context grounding
  const knowledgeCount = home
    ? home.knowledge.length + home.notes.length
    : Array.isArray(simulation.result.knowledge_used)
      ? (simulation.result.knowledge_used as unknown[]).length
      : 0;
  if (knowledgeCount > 0) {
    reasons.push(
      `grounded in ${knowledgeCount} knowledge source${knowledgeCount === 1 ? "" : "s"}`
    );
  }

  // user commitment
  if (simulation.result.chosen_future_id) {
    if (chosen.id === simulation.result.chosen_future_id) {
      reasons.push("matches the path you saved");
    }
  }

  // Always return something scannable
  if (reasons.length === 0) {
    reasons.push("best ranked trade-off for this objective");
  }

  return dedupe(reasons).slice(0, 6);
}

/** Dependency load heuristic from path name + summary language. */
function dependencyLoad(future: FutureRecord): number {
  const text = `${future.name} ${future.summary}`.toLowerCase();
  let load = future.risk * 2; // risk already correlates with complexity
  const heavy = [
    "raise",
    "partner",
    "partners",
    "hire",
    "hiring",
    "agency",
    "series",
    "fundraise",
    "integration",
    "integrations",
    "enterprise",
    "multi-team",
    "committee",
    "depends",
    "dependency",
    "outsource",
  ];
  const light = [
    "bootstrap",
    "solo",
    "minimal",
    "mvp",
    "lean",
    "internal",
    "organic",
    "in-house",
    "focus",
  ];
  for (const w of heavy) {
    if (text.includes(w)) load += 1;
  }
  for (const w of light) {
    if (text.includes(w)) load -= 0.5;
  }
  return load;
}

function average(nums: number[]): number {
  if (!nums.length) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function dedupe(items: string[]): string[] {
  const seen = new Set<string>();
  return items
    .map((r) => r.trim())
    .filter((r) => {
      if (!r || seen.has(r)) return false;
      seen.add(r);
      return true;
    });
}

export function deriveWhyReasons(
  simulation: SimulationRecord,
  chosen: FutureRecord | null,
  goal: GoalRecord | null,
  home?: WorkspaceHome
): string[] {
  const reasons: string[] = [];

  if (typeof simulation.result.recommendation === "string" && simulation.result.recommendation) {
    reasons.push(simulation.result.recommendation.trim());
  } else if (typeof simulation.result.thesis === "string" && simulation.result.thesis) {
    reasons.push(String(simulation.result.thesis).trim());
  }

  if (chosen?.summary) {
    reasons.push(chosen.summary.trim());
  }

  if (chosen) {
    reasons.push(
      `Score ${(chosen.score * 100).toFixed(0)}% with risk ${(chosen.risk * 100).toFixed(0)}%`
    );
  }

  if (goal?.title) {
    reasons.push(`Aligned to goal: ${goal.title}`);
  }

  const knowledgeCount = home ? home.knowledge.length + home.notes.length : 0;
  if (knowledgeCount > 0) {
    reasons.push(`Grounded in ${knowledgeCount} knowledge source${knowledgeCount === 1 ? "" : "s"}`);
  }

  if (simulation.result.chosen_future_id) {
    reasons.push("Path explicitly chosen and saved in this workspace");
  } else if (reasons.length === 0) {
    reasons.push("Engine-ranked top future for this objective");
  }

  return dedupe(reasons).slice(0, 6);
}

function resolveRisks(
  simulation: SimulationRecord,
  chosen: FutureRecord | null
): string[] {
  const fromResult = Array.isArray(simulation.result.risks)
    ? (simulation.result.risks as string[]).filter(Boolean)
    : [];
  if (fromResult.length) return fromResult.slice(0, 6);

  const risks: string[] = [];
  if (chosen && chosen.risk >= 0.55) {
    risks.push("Elevated path risk — assign owners before committing");
  }
  if (chosen && chosen.confidence < 0.55) {
    risks.push("Confidence below 55% — gather more evidence");
  }
  if (!risks.length) {
    risks.push("Monitor execution assumptions as the path progresses");
  }
  return risks;
}

function deriveNextActions(
  simulation: SimulationRecord,
  chosen: FutureRecord | null,
  risks: string[]
): string[] {
  const actions: string[] = [];
  const name = chosen?.name ?? String(simulation.result.best_future ?? "the recommended path");

  if (!simulation.result.chosen_future_id) {
    actions.push(`Choose and save “${name}” as the committed path`);
  } else if (!simulation.result.outcome_followed) {
    actions.push("Record whether you followed this recommendation");
  } else if (!simulation.result.outcome_result) {
    actions.push("Log how the decision turned out for future memory");
  } else {
    actions.push(`Execute on “${name}” and keep logging outcomes into knowledge`);
  }

  if (risks[0]) {
    actions.push(`Address risk: ${risks[0]}`);
  }

  actions.push("Re-run with tighter constraints if the landscape shifts");
  actions.push("Capture a working note with decision rationale");

  return actions.slice(0, 5);
}

function parseOutcomeFollowed(raw: unknown): OutcomeFollowed | null {
  if (raw === "yes" || raw === "partially" || raw === "no") return raw;
  return null;
}

/** Markdown export — matches result page contract order. */
export function exportDecisionReportMarkdown(report: DecisionReport): string {
  const conf = `${Math.round(report.confidence * 100)}%`;
  const summaryBits = [
    report.summary.strategiesGenerated != null
      ? `${report.summary.strategiesGenerated} strategies`
      : null,
    report.summary.pathsEvaluated != null
      ? `${report.summary.pathsEvaluated} paths evaluated`
      : null,
    report.summary.disqualifiedCount != null && report.summary.disqualifiedCount > 0
      ? `${report.summary.disqualifiedCount} disqualified`
      : null,
  ].filter(Boolean);

  const lines = [
    `# Decision Report`,
    ``,
    `## Goal`,
    report.decisionTitle,
    report.objective !== report.decisionTitle ? report.objective : null,
    report.objectiveDescription ? report.objectiveDescription : null,
    ``,
    `## Simulation summary`,
    summaryBits.length ? summaryBits.join(" · ") : report.summary.status,
    report.pathSaved ? `Status: Path saved` : `Status: Engine recommendation`,
    ``,
    `## Evidence`,
    `- Knowledge sources used: ${report.evidence.knowledgeSourcesUsed}`,
    `- Constraints evaluated: ${report.evidence.constraintsEvaluated}`,
    `- Strategies generated: ${report.evidence.strategiesGenerated}`,
    ``,
    `### Evaluation criteria`,
    ...report.evidence.criteria.map(
      (c) => `- ${c.evaluated ? "✓" : "—"} ${c.label}`
    ),
    ...(report.contextUsed.length
      ? ["", "### Context used", ...report.contextUsed.map((c) => `- [${c.type}] ${c.title}`)]
      : []),
    ``,
    `## Recommendation`,
    report.recommended,
    report.recommendedSummary ? report.recommendedSummary : null,
    `Confidence: ${conf}`,
    ``,
    `## Why this was chosen`,
    ...report.recommendedBecause.map((r) => `- ${r}`),
    ...report.why.map((w) => `- ${w}`),
    ``,
    `## Expected value`,
    ...(report.expectedValue.rows.length
      ? report.expectedValue.rows.map((r) => `- **${r.label}:** ${r.value}`)
      : ["- (insufficient signals)"]),
    report.expectedValue.reason ? `Reason: ${report.expectedValue.reason}` : null,
    ``,
    `## Compare alternatives`,
    ...(report.tradeoffs.length
      ? report.tradeoffs.map((t) => `- **${t.name}:** ${t.vsBest}`)
      : report.alternatives.map(
          (a) =>
            `- **${a.name}**${a.isRecommended ? " · recommended" : ""} — conf ${(a.confidence * 100).toFixed(0)}% · risk ${(a.risk * 100).toFixed(0)}% · score ${(a.score * 100).toFixed(0)}%`
        )),
    ``,
    `## Risks`,
    ...report.risks.map((r) => `- ${r}`),
    ``,
    `## Next actions`,
    ...report.nextActions.map((a, i) => `${i + 1}. ${a}`),
    ``,
    `## Save decision`,
    report.pathSaved
      ? `Path saved${report.outcomeFollowed ? ` · Followed: ${report.outcomeFollowed}` : ""}`
      : `Pending — choose and save a path`,
    ``,
    `---`,
    `Simulation: ${report.simulationTitle} (${report.simulationId})`,
  ].filter((line): line is string => line != null);
  return lines.join("\n");
}
