import {
  githubReadmeCandidates,
  inferUploadType,
  isGithubRepoUrl,
} from "../../domain/workspace/knowledge";
import type { KnowledgeType } from "../../domain/workspace/types";

export type PreparedKnowledge = {
  type: KnowledgeType;
  title: string;
  content: string;
  metadata: Record<string, unknown>;
};

export type UrlExtractionResult = {
  url: string;
  title: string;
  content: string;
  ok: boolean;
  status?: number;
  warning?: string;
};

/**
 * Read an uploaded file into a knowledge record (RAG-lite).
 * PDF is stored as a titled reference + any extractable/pasted text.
 * MD/TXT are stored as full text content.
 */
export async function prepareUploadFile(file: File): Promise<PreparedKnowledge> {
  const type = inferUploadType(file.name);
  if (!type) {
    throw new Error("Only PDF, Markdown (.md), and TXT files are supported.");
  }

  if (type === "pdf") {
    return {
      type: "pdf",
      title: file.name,
      content: `[PDF] ${file.name}\nSize: ${file.size} bytes. Paste excerpts if you need searchable text.`,
      metadata: {
        filename: file.name,
        mime: file.type || "application/pdf",
        size: file.size,
        source: "upload",
      },
    };
  }

  const text = await file.text();
  return {
    type,
    title: file.name,
    content: text,
    metadata: {
      filename: file.name,
      mime: file.type || "text/plain",
      size: file.size,
      source: "upload",
    },
  };
}

/**
 * Prepare multiple files for upload (drag-drop batches).
 * Skips unsupported names and continues; throws only if none succeed.
 */
export async function prepareUploadFiles(files: FileList | File[]): Promise<PreparedKnowledge[]> {
  const list = Array.from(files);
  if (list.length === 0) throw new Error("No files selected.");

  const prepared: PreparedKnowledge[] = [];
  const errors: string[] = [];
  for (const file of list) {
    try {
      prepared.push(await prepareUploadFile(file));
    } catch (err) {
      errors.push(`${file.name}: ${(err as Error).message}`);
    }
  }
  if (prepared.length === 0) {
    throw new Error(errors[0] || "No supported files (PDF, Markdown, TXT).");
  }
  return prepared;
}

/**
 * Extract web content for preview before committing to the library.
 */
export async function extractWebContent(rawUrl: string): Promise<UrlExtractionResult> {
  const url = rawUrl.trim();
  if (!url) throw new Error("URL is required.");

  if (isGithubRepoUrl(url) || /raw\.githubusercontent\.com/i.test(url)) {
    const prepared = await prepareGithubReadme(url);
    return {
      url,
      title: prepared.title,
      content: prepared.content,
      ok: true,
    };
  }

  try {
    const res = await fetch(url, { method: "GET" });
    if (!res.ok) {
      return {
        url,
        title: url,
        content: `Imported URL (fetch ${res.status}). Content will be available when the source allows access.`,
        ok: false,
        status: res.status,
        warning: `Fetch returned ${res.status}`,
      };
    }
    const text = await res.text();
    const content = text
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 50_000);
    const titleMatch = text.match(/<title[^>]*>([^<]*)<\/title>/i);
    const title = titleMatch?.[1]?.trim().slice(0, 200) || url;
    return { url, title, content, ok: true, status: res.status };
  } catch {
    return {
      url,
      title: url,
      content:
        "Imported URL. Browser could not fetch body (CORS). Title is searchable; paste content if needed.",
      ok: false,
      warning: "CORS or network blocked fetch",
    };
  }
}

/**
 * Import a website URL or GitHub README.
 * GitHub: tries raw README from main/master.
 * Website: stores URL; attempts fetch when CORS allows.
 * Returns PreparedKnowledge; also attaches extraction metadata when available.
 */
export async function prepareImportUrl(rawUrl: string): Promise<PreparedKnowledge & { extraction?: UrlExtractionResult }> {
  const url = rawUrl.trim();
  if (!url) throw new Error("URL is required.");

  if (isGithubRepoUrl(url) || /raw\.githubusercontent\.com/i.test(url)) {
    const prepared = await prepareGithubReadme(url);
    return {
      ...prepared,
      extraction: {
        url,
        title: prepared.title,
        content: prepared.content,
        ok: true,
      },
    };
  }

  const extraction = await extractWebContent(url);
  return {
    type: "url",
    title: extraction.title,
    content: extraction.content,
    metadata: {
      url,
      source: "website",
      extraction_ok: extraction.ok,
      extraction_warning: extraction.warning ?? null,
    },
    extraction,
  };
}

async function prepareGithubReadme(input: string): Promise<PreparedKnowledge> {
  const candidates = /raw\.githubusercontent\.com/i.test(input)
    ? [input]
    : githubReadmeCandidates(input);

  if (candidates.length === 0) {
    throw new Error("Could not parse GitHub repository URL.");
  }

  let lastError = "README not found";
  for (const candidate of candidates) {
    try {
      const res = await fetch(candidate);
      if (!res.ok) {
        lastError = `README fetch ${res.status}`;
        continue;
      }
      const content = (await res.text()).slice(0, 100_000);
      const parts = candidate.split("/");
      const repo = parts[4] ?? "repo";
      return {
        type: "github",
        title: `${repo} README`,
        content,
        metadata: {
          url: input,
          raw_url: candidate,
          source: "github_readme",
        },
      };
    } catch (err) {
      lastError = (err as Error).message;
    }
  }

  throw new Error(`Could not import GitHub README: ${lastError}`);
}
