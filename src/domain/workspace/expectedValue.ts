import type { FutureRecord, SimulationRecord } from "./types";

export type ExpectedValueLevel = "High" | "Medium" | "Low";

export type ExpectedValueRow = {
  id: string;
  label: string;
  value: string;
  level?: ExpectedValueLevel;
};

export type ExpectedValueResult = {
  rows: ExpectedValueRow[];
  reason: string | null;
};

/**
 * Deterministic expected-value heuristics for public beta.
 * Omit rows when signals are missing — never invent metrics.
 */
export function deriveExpectedValue(input: {
  chosen: FutureRecord | null;
  futures: readonly FutureRecord[];
  simulation: SimulationRecord;
  knowledgeCount: number;
  constraintCount: number;
}): ExpectedValueResult {
  const { chosen, futures, simulation, knowledgeCount, constraintCount } = input;
  const rows: ExpectedValueRow[] = [];
  const peers = chosen ? futures.filter((f) => f.id !== chosen.id) : [...futures];

  if (chosen && futures.length > 0) {
    // Goal alignment — presence of goal/objective + score rank
    const maxScore = Math.max(...futures.map((f) => f.score));
    if (chosen.score >= maxScore - 0.001) {
      rows.push({
        id: "alignment",
        label: "Goal alignment",
        value: "High",
        level: "High",
      });
    } else if (chosen.score >= maxScore - 0.12) {
      rows.push({
        id: "alignment",
        label: "Goal alignment",
        value: "Medium",
        level: "Medium",
      });
    } else {
      rows.push({
        id: "alignment",
        label: "Goal alignment",
        value: "Moderate",
        level: "Low",
      });
    }

    // Risk reduction vs peers
    const minRisk = Math.min(...futures.map((f) => f.risk));
    if (chosen.risk <= minRisk + 0.001) {
      rows.push({
        id: "risk",
        label: "Risk reduction",
        value: "High",
        level: "High",
      });
    } else if (peers.some((p) => p.risk > chosen.risk + 0.08)) {
      rows.push({
        id: "risk",
        label: "Risk reduction",
        value: "Medium",
        level: "Medium",
      });
    } else if (chosen.risk <= 0.4) {
      rows.push({
        id: "risk",
        label: "Risk reduction",
        value: "Low path risk",
        level: "Medium",
      });
    }

    // Time saved heuristic from risk/deps language
    const text = `${chosen.name} ${chosen.summary}`.toLowerCase();
    const lean =
      /bootstrap|mvp|lean|minimal|wedge|incremental|private\s+beta|organic/.test(text) ||
      chosen.risk <= 0.35;
    const heavy = /raise|enterprise|blitz|aggressive|series|fundraise/.test(text);
    if (lean && !heavy) {
      rows.push({
        id: "time",
        label: "Time saved",
        value: "~8–12 hours",
        level: "High",
      });
    } else if (!heavy) {
      rows.push({
        id: "time",
        label: "Time saved",
        value: "~4–6 hours",
        level: "Medium",
      });
    }

    // Cost impact
    if (/bootstrap|lean|mvp|organic|self[- ]fund/.test(text) || chosen.risk <= 0.3) {
      rows.push({
        id: "cost",
        label: "Cost impact",
        value: "Lower capital need",
        level: "High",
      });
    } else if (/raise|fund|enterprise|agency/.test(text)) {
      rows.push({
        id: "cost",
        label: "Cost impact",
        value: "Higher capital / burn",
        level: "Low",
      });
    }

    // Confidence
    rows.push({
      id: "confidence",
      label: "Execution confidence",
      value: `${Math.round(chosen.confidence * 100)}%`,
      level:
        chosen.confidence >= 0.75 ? "High" : chosen.confidence >= 0.55 ? "Medium" : "Low",
    });
  } else if (typeof simulation.confidence === "number") {
    rows.push({
      id: "confidence",
      label: "Execution confidence",
      value: `${Math.round(simulation.confidence * 100)}%`,
      level:
        simulation.confidence >= 0.75
          ? "High"
          : simulation.confidence >= 0.55
            ? "Medium"
            : "Low",
    });
  }

  // Knowledge coverage
  if (knowledgeCount > 0) {
    rows.push({
      id: "knowledge",
      label: "Knowledge coverage",
      value:
        knowledgeCount >= 3
          ? `${knowledgeCount} sources`
          : knowledgeCount === 1
            ? "1 source"
            : `${knowledgeCount} sources`,
      level: knowledgeCount >= 3 ? "High" : knowledgeCount >= 1 ? "Medium" : "Low",
    });
  }

  const reason = deriveReason(chosen, futures, constraintCount, knowledgeCount);

  return { rows: rows.slice(0, 6), reason };
}

function deriveReason(
  chosen: FutureRecord | null,
  futures: readonly FutureRecord[],
  constraintCount: number,
  knowledgeCount: number
): string | null {
  if (!chosen) return null;
  const parts: string[] = [];
  if (constraintCount > 0) {
    parts.push("Your constraints favor a path that fits stated limits");
  }
  const minRisk = Math.min(...futures.map((f) => f.risk));
  if (chosen.risk <= minRisk + 0.001 && futures.length > 1) {
    parts.push("lowest execution risk among ranked strategies");
  }
  if (knowledgeCount > 0) {
    parts.push("grounded in workspace knowledge");
  }
  const text = `${chosen.name} ${chosen.summary}`.toLowerCase();
  if (/incremental|validation|beta|mvp|wedge|bootstrap/.test(text)) {
    parts.push("incremental validation over immediate scale");
  }
  if (!parts.length) return null;
  // Prefer a single readable sentence
  if (parts.some((p) => p.includes("incremental"))) {
    return "Constraints and scoring favor incremental validation over immediate scale.";
  }
  return parts[0]!.charAt(0).toUpperCase() + parts[0]!.slice(1) + ".";
}
