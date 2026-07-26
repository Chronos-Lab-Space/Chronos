import type { KnowledgeRecord, KnowledgeType, NoteRecord } from "./types";

/** RAG-lite search hit across knowledge + notes. */
export type KnowledgeSearchHit = {
  id: string;
  kind: "knowledge" | "note";
  type: KnowledgeType | "note";
  title: string;
  content: string;
  created_at: string;
  score: number;
};

export function inferUploadType(filename: string): KnowledgeType | null {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".pdf")) return "pdf";
  if (lower.endsWith(".md") || lower.endsWith(".markdown")) return "markdown";
  if (lower.endsWith(".txt") || lower.endsWith(".text")) return "txt";
  return null;
}

export function isAllowedUpload(filename: string): boolean {
  return inferUploadType(filename) !== null;
}

/**
 * Keyword search over title + content (case-insensitive).
 * Score = title matches weighted higher than body matches.
 */
export function searchLibrary(
  knowledge: readonly KnowledgeRecord[],
  notes: readonly NoteRecord[],
  query: string
): KnowledgeSearchHit[] {
  const q = query.trim().toLowerCase();
  if (!q) {
    return [
      ...knowledge.map((k) => toHit("knowledge", k.type, k)),
      ...notes.map((n) => toHit("note", "note", n)),
    ].sort((a, b) => b.created_at.localeCompare(a.created_at));
  }

  const tokens = q.split(/\s+/).filter(Boolean);
  const hits: KnowledgeSearchHit[] = [];

  for (const item of knowledge) {
    const score = scoreMatch(item.title, item.content, tokens);
    if (score > 0) {
      hits.push({ ...toHit("knowledge", item.type, item), score });
    }
  }
  for (const note of notes) {
    const score = scoreMatch(note.title, note.content, tokens);
    if (score > 0) {
      hits.push({ ...toHit("note", "note", note), score });
    }
  }

  return hits.sort((a, b) => b.score - a.score || b.created_at.localeCompare(a.created_at));
}

function scoreMatch(title: string, content: string, tokens: string[]): number {
  const t = title.toLowerCase();
  const c = content.toLowerCase();
  let score = 0;
  for (const token of tokens) {
    if (t.includes(token)) score += 3;
    if (c.includes(token)) score += 1;
  }
  return score;
}

function toHit(
  kind: "knowledge" | "note",
  type: KnowledgeType | "note",
  item: { id: string; title: string; content: string; created_at: string }
): KnowledgeSearchHit {
  return {
    id: item.id,
    kind,
    type,
    title: item.title,
    content: item.content,
    created_at: item.created_at,
    score: 0,
  };
}

/** Parse github.com/owner/repo[/tree/branch] into raw README candidates. */
export function githubReadmeCandidates(input: string): string[] {
  const trimmed = input.trim().replace(/\/$/, "");
  const match = trimmed.match(
    /^https?:\/\/github\.com\/([^/]+)\/([^/#?]+)(?:\/(?:tree|blob)\/([^/]+))?/i
  );
  if (!match) return [];
  const owner = match[1];
  const repo = match[2].replace(/\.git$/i, "");
  const branch = match[3] || "main";
  const branches = branch === "main" ? ["main", "master"] : [branch, "main", "master"];
  const unique = [...new Set(branches)];
  return unique.flatMap((b) => [
    `https://raw.githubusercontent.com/${owner}/${repo}/${b}/README.md`,
    `https://raw.githubusercontent.com/${owner}/${repo}/${b}/readme.md`,
  ]);
}

export function isGithubRepoUrl(input: string): boolean {
  return /^https?:\/\/github\.com\/[^/]+\/[^/#?]+/i.test(input.trim());
}

/** Minimal markdown → HTML for the note preview (RAG-lite, no heavy editor). */
export function renderSimpleMarkdown(source: string): string {
  // Escape quotes too: link URLs are interpolated into href="…", so an
  // unescaped " would allow attribute injection (e.g. onmouseover=…).
  const escaped = source
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

  const lines = escaped.split("\n");
  const html: string[] = [];
  let inList = false;

  const flushList = () => {
    if (inList) {
      html.push("</ul>");
      inList = false;
    }
  };

  for (const line of lines) {
    if (/^###\s+/.test(line)) {
      flushList();
      html.push(`<h3>${inline(line.replace(/^###\s+/, ""))}</h3>`);
    } else if (/^##\s+/.test(line)) {
      flushList();
      html.push(`<h2>${inline(line.replace(/^##\s+/, ""))}</h2>`);
    } else if (/^#\s+/.test(line)) {
      flushList();
      html.push(`<h1>${inline(line.replace(/^#\s+/, ""))}</h1>`);
    } else if (/^[-*]\s+/.test(line)) {
      if (!inList) {
        html.push("<ul>");
        inList = true;
      }
      html.push(`<li>${inline(line.replace(/^[-*]\s+/, ""))}</li>`);
    } else if (line.trim() === "") {
      flushList();
      html.push("<br/>");
    } else {
      flushList();
      html.push(`<p>${inline(line)}</p>`);
    }
  }
  flushList();
  return html.join("");
}

function inline(text: string): string {
  return text
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(
      /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g,
      '<a href="$2" target="_blank" rel="noreferrer">$1</a>'
    );
}

export function snippet(content: string, max = 160): string {
  const flat = content.replace(/\s+/g, " ").trim();
  if (flat.length <= max) return flat;
  return `${flat.slice(0, max - 1)}…`;
}
