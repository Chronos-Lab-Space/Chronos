/**
 * Rendering helpers for stored prose.
 *
 * `SimulationEngine.splitBrief` keeps the AI-written brief body as a single
 * string with blank lines between paragraphs, because that is what fits in a
 * JSONB field. A single <p> then collapses those blank lines to spaces — the
 * model writes three paragraphs and the reader gets one block.
 */

/**
 * Blank-line-separated paragraphs, trimmed, with empties dropped.
 *
 * Soft wraps *inside* a paragraph are left alone: HTML collapses them, so
 * rewriting them would change the stored text for no visible gain.
 */
export function toParagraphs(text: string | null | undefined): string[] {
  if (typeof text !== "string") return [];
  return text
    .split(/\n[ \t]*\n/)
    .map((part) => part.trim())
    .filter(Boolean);
}
