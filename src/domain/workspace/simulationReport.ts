import type {
  FutureRecord,
  KnowledgeRecord,
  NoteRecord,
  SimulationRecord,
  WorkspaceHome,
} from "./types";

/** Compact knowledge reference stored on a simulation result. */
export type KnowledgeUsedRef = {
  id: string;
  type: string;
  title: string;
};

export type SimulationDetail = {
  simulation: SimulationRecord;
  futures: readonly FutureRecord[];
  goalTitle: string | null;
  goalDescription: string | null;
  recommendation: string;
  risks: string[];
  confidence: number | null;
  knowledgeUsed: KnowledgeUsedRef[];
  tradeoffs: TradeoffRow[];
  constraints: string[];
  plannerTasks: string[];
};

export type TradeoffRow = {
  futureId: string;
  name: string;
  score: number;
  risk: number;
  confidence: number;
  vsBest: string;
};

/**
 * Snapshot of library items present when the sim ran.
 * Stored on result.knowledge_used for reopenable reports.
 */
export function snapshotKnowledgeUsed(
  knowledge: readonly KnowledgeRecord[],
  notes: readonly NoteRecord[] = []
): KnowledgeUsedRef[] {
  const fromKnowledge = knowledge.map((k) => ({
    id: k.id,
    type: k.type,
    title: k.title,
  }));
  const fromNotes = notes
    .filter((n) => !knowledge.some((k) => k.metadata?.note_id === n.id))
    .map((n) => ({
      id: n.id,
      type: "note",
      title: n.title,
    }));
  return [...fromKnowledge, ...fromNotes].slice(0, 50);
}

/** Resolve knowledge_used from result payload or fall back to current library. */
export function resolveKnowledgeUsed(
  simulation: SimulationRecord,
  home: WorkspaceHome
): KnowledgeUsedRef[] {
  const raw = simulation.result.knowledge_used;
  if (Array.isArray(raw) && raw.length > 0) {
    return raw
      .map((item) => {
        if (!item || typeof item !== "object") return null;
        const rec = item as Record<string, unknown>;
        const id = typeof rec.id === "string" ? rec.id : null;
        const title = typeof rec.title === "string" ? rec.title : null;
        if (!id || !title) return null;
        return {
          id,
          type: typeof rec.type === "string" ? rec.type : "unknown",
          title,
        };
      })
      .filter((x): x is KnowledgeUsedRef => x != null);
  }
  return snapshotKnowledgeUsed(home.knowledge, home.notes);
}

export function deriveTradeoffs(
  futures: readonly FutureRecord[]
): TradeoffRow[] {
  if (futures.length === 0) return [];
  const best = futures[0];
  return futures.map((f) => {
    const scoreDelta = f.score - best.score;
    const riskDelta = f.risk - best.risk;
    let vsBest = "Baseline (engine best)";
    if (f.id !== best.id) {
      const parts: string[] = [];
      if (scoreDelta < -0.02) {
        parts.push(`${Math.abs(Math.round(scoreDelta * 100))} pts lower score`);
      }
      if (riskDelta > 0.02) {
        parts.push(`${Math.round(riskDelta * 100)} pts higher risk`);
      } else if (riskDelta < -0.02) {
        parts.push(`${Math.abs(Math.round(riskDelta * 100))} pts lower risk`);
      }
      if (f.confidence < best.confidence - 0.02) {
        parts.push("lower confidence");
      }
      vsBest = parts.length ? parts.join(" · ") : "Similar profile";
    }
    return {
      futureId: f.id,
      name: f.name,
      score: f.score,
      risk: f.risk,
      confidence: f.confidence,
      vsBest,
    };
  });
}

export function buildSimulationDetail(
  home: WorkspaceHome,
  simulation: SimulationRecord
): SimulationDetail {
  const futures = home.futuresBySimulation[simulation.id] ?? [];
  const risks = Array.isArray(simulation.result.risks)
    ? (simulation.result.risks as string[]).filter(Boolean)
    : [];
  const recommendation =
    (typeof simulation.result.recommendation === "string" &&
      simulation.result.recommendation) ||
    (typeof simulation.result.thesis === "string" && simulation.result.thesis) ||
    "—";
  const constraints = Array.isArray(simulation.result.constraints)
    ? (simulation.result.constraints as string[])
    : [];
  const plannerTasks = Array.isArray(simulation.result.planner_tasks)
    ? (simulation.result.planner_tasks as string[])
    : [];

  return {
    simulation,
    futures,
    goalTitle: home.goal?.title ?? null,
    goalDescription: home.goal?.description ?? null,
    recommendation,
    risks,
    confidence: simulation.confidence,
    knowledgeUsed: resolveKnowledgeUsed(simulation, home),
    tradeoffs: deriveTradeoffs(futures),
    constraints,
    plannerTasks,
  };
}

export function exportSimulationMarkdown(detail: SimulationDetail): string {
  const conf =
    detail.confidence != null
      ? `${Math.round(detail.confidence * 100)}%`
      : "—";
  const lines = [
    `# Simulation: ${detail.simulation.title}`,
    ``,
    `**Status:** ${detail.simulation.status}`,
    `**Version:** v${detail.simulation.version}`,
    `**Confidence:** ${conf}`,
    detail.goalTitle ? `**Goal:** ${detail.goalTitle}` : null,
    ``,
    `## Recommendation`,
    detail.recommendation,
    ``,
    `## Futures`,
    ...detail.futures.map(
      (f, i) =>
        `${i + 1}. **${f.name}** — score ${(f.score * 100).toFixed(0)}% · risk ${(f.risk * 100).toFixed(0)}% · conf ${(f.confidence * 100).toFixed(0)}%\n   ${f.summary}`
    ),
    ``,
    `## Tradeoffs`,
    ...detail.tradeoffs.map((t) => `- **${t.name}:** ${t.vsBest}`),
    ``,
    `## Risks`,
    ...(detail.risks.length ? detail.risks.map((r) => `- ${r}`) : ["- —"]),
    ``,
    `## Knowledge used`,
    ...(detail.knowledgeUsed.length
      ? detail.knowledgeUsed.map((k) => `- [${k.type}] ${k.title}`)
      : ["- (none recorded)"]),
    ``,
    `## Constraints`,
    ...(detail.constraints.length
      ? detail.constraints.map((c) => `- ${c}`)
      : ["- —"]),
  ].filter((line): line is string => line != null);
  return lines.join("\n");
}

export function exportSimulationJson(detail: SimulationDetail): string {
  return JSON.stringify(
    {
      simulation: detail.simulation,
      futures: detail.futures,
      goalTitle: detail.goalTitle,
      recommendation: detail.recommendation,
      risks: detail.risks,
      confidence: detail.confidence,
      knowledgeUsed: detail.knowledgeUsed,
      tradeoffs: detail.tradeoffs,
      constraints: detail.constraints,
    },
    null,
    2
  );
}

/** Browser download helper (no-op in non-DOM environments). */
export function downloadTextFile(
  filename: string,
  content: string,
  mime = "text/plain"
): void {
  if (typeof document === "undefined") return;
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
