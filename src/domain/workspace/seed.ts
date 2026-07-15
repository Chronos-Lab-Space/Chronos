import type { KnowledgeRecord } from "./types";

export function knowledgeCounts(items: readonly KnowledgeRecord[]) {
  return {
    pdfs: items.filter((k) => k.type === "pdf").length,
    notes: items.filter((k) => k.type === "note").length,
    websites: items.filter((k) => k.type === "website").length,
    research: items.filter((k) => k.type === "research").length,
  };
}

export function confidencePercent(value: number | null | undefined): string {
  if (value == null) return "—";
  return `${Math.round(value * 100)}%`;
}
