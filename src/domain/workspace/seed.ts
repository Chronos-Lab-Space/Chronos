import type { KnowledgeRecord } from "./types";

export function knowledgeCounts(items: readonly KnowledgeRecord[]) {
  return {
    documents: items.filter((k) => k.type === "pdf" || k.type === "markdown" || k.type === "txt")
      .length,
    notes: items.filter((k) => k.type === "note").length,
    urls: items.filter((k) => k.type === "url" || k.type === "github").length,
  };
}

export function confidencePercent(value: number | null | undefined): string {
  if (value == null) return "—";
  return `${Math.round(value * 100)}%`;
}

export function formatCreatedAt(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}
