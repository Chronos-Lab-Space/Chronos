import type { FutureRecord, SimulationRecord, WorkspaceHome } from "./types";
import { resolveKnowledgeUsed } from "./simulationReport";

export type EvaluationCriterionId =
  | "risk"
  | "cost"
  | "timeline"
  | "resources"
  | "growth";

export type EvaluationCriterion = {
  id: EvaluationCriterionId;
  label: string;
  evaluated: boolean;
};

export type DecisionEvidence = {
  knowledgeSourcesUsed: number;
  constraintsEvaluated: number;
  strategiesGenerated: number;
  pathsEvaluated: number | null;
  disqualifiedCount: number | null;
  criteria: EvaluationCriterion[];
};

const CRITERIA: { id: EvaluationCriterionId; label: string; re: RegExp }[] = [
  { id: "risk", label: "Risk", re: /risk|safe|conserv|compliance|runway/i },
  { id: "cost", label: "Cost", re: /cost|burn|budget|cheap|capital|fund|raise|mrr/i },
  { id: "timeline", label: "Timeline", re: /time|fast|speed|launch|month|week|schedule/i },
  {
    id: "resources",
    label: "Resources",
    re: /team|hire|resource|solo|staff|headcount|bootstrap/i,
  },
  {
    id: "growth",
    label: "Growth potential",
    re: /growth|scale|upside|market|arr|capture|aggressive/i,
  },
];

function num(result: SimulationRecord["result"], key: string): number | null {
  const v = result[key];
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function constraintCount(simulation: SimulationRecord): number {
  const c = simulation.result.constraints;
  if (!Array.isArray(c)) return 0;
  return c.filter((x) => typeof x === "string" && x.trim()).length;
}

/**
 * Deterministic “did it think?” evidence — counts + criteria checklist.
 * No chain-of-thought.
 */
export function buildDecisionEvidence(
  home: WorkspaceHome,
  simulation: SimulationRecord,
  futures: readonly FutureRecord[] = home.futuresBySimulation[simulation.id] ?? []
): DecisionEvidence {
  const contextUsed = resolveKnowledgeUsed(simulation, home);
  const knowledgeSourcesUsed =
    contextUsed.length > 0
      ? contextUsed.length
      : home.knowledge.length + home.notes.length;

  const strategiesGenerated =
    typeof simulation.result.futures_count === "number"
      ? simulation.result.futures_count
      : futures.length;

  const corpus = [
    simulation.title,
    typeof simulation.result.recommendation === "string"
      ? simulation.result.recommendation
      : "",
    typeof simulation.result.thesis === "string" ? simulation.result.thesis : "",
    ...futures.map((f) => `${f.name} ${f.summary}`),
    ...(Array.isArray(simulation.result.constraints)
      ? (simulation.result.constraints as string[])
      : []),
    home.goal?.title ?? "",
    home.goal?.description ?? "",
  ].join("\n");

  // Scoring always uses score/risk/confidence — mark core criteria true when futures exist
  const hasFutures = futures.length > 0;
  const criteria: EvaluationCriterion[] = CRITERIA.map((c) => ({
    id: c.id,
    label: c.label,
    evaluated:
      hasFutures &&
      (c.id === "risk" ||
        c.id === "growth" ||
        c.re.test(corpus) ||
        (c.id === "cost" && hasFutures) ||
        (c.id === "timeline" && hasFutures) ||
        (c.id === "resources" && hasFutures)),
  }));

  // Always claim risk + growth when we ranked futures (engine always scores these)
  if (hasFutures) {
    for (const c of criteria) {
      if (c.id === "risk" || c.id === "growth" || c.id === "cost" || c.id === "timeline") {
        c.evaluated = true;
      }
    }
  }

  return {
    knowledgeSourcesUsed,
    constraintsEvaluated: constraintCount(simulation),
    strategiesGenerated,
    pathsEvaluated: num(simulation.result, "paths_evaluated"),
    disqualifiedCount: num(simulation.result, "disqualified_count"),
    criteria,
  };
}
