import type { SimulationRecord } from "./types";

/**
 * Side-by-side read of two versions of the same decision. Pure formatting —
 * no scoring, no re-ranking, nothing the engine already owns. A blank field
 * reads as "missing data" only when it says so; every row shows a value.
 */
export type ComparisonRow = {
  label: string;
  a: string;
  b: string;
};

function pct(confidence: number | null): string {
  return confidence == null ? "—" : `${Math.round(confidence * 100)}%`;
}

function text(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) return "—";
  return value;
}

function riskCount(version: SimulationRecord): string {
  return Array.isArray(version.result.risks) ? String(version.result.risks.length) : "—";
}

export function compareVersions(a: SimulationRecord, b: SimulationRecord): ComparisonRow[] {
  return [
    { label: "Version", a: `v${a.version}`, b: `v${b.version}` },
    { label: "Status", a: a.status, b: b.status },
    { label: "Confidence", a: pct(a.confidence), b: pct(b.confidence) },
    {
      label: "Chosen path",
      a: text(a.result.chosen_future_name),
      b: text(b.result.chosen_future_name),
    },
    {
      label: "Recommendation",
      a: text(a.result.recommendation),
      b: text(b.result.recommendation),
    },
    { label: "Risks", a: riskCount(a), b: riskCount(b) },
  ];
}
