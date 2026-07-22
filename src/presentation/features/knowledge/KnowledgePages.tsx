import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  prepareImportUrl,
  prepareUploadFile,
} from "../../../application/workspace/KnowledgeImport";
import {
  renderSimpleMarkdown,
  searchLibrary,
  snippet,
  type KnowledgeSearchHit,
} from "../../../domain/workspace/knowledge";
import { knowledgeCounts } from "../../../domain/workspace/seed";
import { useWorkspace } from "../workspace/WorkspaceContext";
import { MarkdownNoteEditor } from "./components/MarkdownNoteEditor";

/**
 * Phase 3 — Knowledge Library (RAG-lite).
 * Upload PDF/MD/TXT · Import website/GitHub README · Notes markdown · keyword search.
 */
export function KnowledgePage() {
  const { home, addKnowledge, error } = useWorkspace();
  const [params, setParams] = useSearchParams();
  const panel = params.get("upload") === "1" ? "upload" : params.get("import") ? "import" : null;

  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);
  const [selected, setSelected] = useState<KnowledgeSearchHit | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [paste, setPaste] = useState("");
  const [importUrl, setImportUrl] = useState("https://");
  const [importMode, setImportMode] = useState<"website" | "github">(
    params.get("import") === "github" ? "github" : "website"
  );

  const knowledge = home?.knowledge ?? [];
  const notes = home?.notes ?? [];

  const counts = useMemo(() => knowledgeCounts(knowledge), [knowledge]);
  const hits = useMemo(
    () => searchLibrary(knowledge, notes, query),
    [knowledge, notes, query]
  );

  if (!home) return null;

  const openPanel = (next: "upload" | "import" | null) => {
    if (!next) setParams({});
    else if (next === "upload") setParams({ upload: "1" });
    else setParams({ import: importMode === "github" ? "github" : "url" });
  };

  const onUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setLocalError("Choose a PDF, Markdown, or TXT file.");
      return;
    }
    setBusy(true);
    setLocalError(null);
    try {
      const prepared = await prepareUploadFile(file);
      if (paste.trim()) {
        prepared.content = `${prepared.content}\n\n${paste.trim()}`;
      }
      await addKnowledge(prepared);
      setFile(null);
      setPaste("");
      openPanel(null);
      setJustSaved(true);
    } catch (err) {
      setLocalError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const onImport = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setLocalError(null);
    try {
      const prepared = await prepareImportUrl(importUrl);
      await addKnowledge(prepared);
      setImportUrl("https://");
      openPanel(null);
      setJustSaved(true);
    } catch (err) {
      setLocalError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const err = localError || error;

  return (
    <div className="ws-cascade">
      <div className="header-enter flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-faint">
            Knowledge
          </div>
          <h1 className="mt-2 font-serif text-3xl text-ink">Library</h1>
          <p className="mt-2 max-w-lg text-sm text-ink-dim">
            RAG-lite context for simulations — files, URLs, and notes. Search by keyword across
            title and content.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ActionButton label="+ Upload" onClick={() => openPanel("upload")} active={panel === "upload"} />
          <ActionButton label="+ Import" onClick={() => openPanel("import")} active={panel === "import"} />
          <Link
            to="/workspace/notes?new=1"
            className="rounded-full border border-line px-3 py-1.5 text-sm text-ink transition hover:border-chronos/50 hover:text-chronos"
          >
            + Note
          </Link>
        </div>
      </div>

      <div className="mt-8">
        <label
          htmlFor="knowledge-search"
          className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint"
        >
          Search
        </label>
        <input
          id="knowledge-search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Keyword · title · content"
          className="mt-2 w-full rounded-lg border border-line bg-bg px-3 py-2.5 text-sm text-ink placeholder:text-ink-faint transition focus:border-chronos focus:outline-none"
        />
      </div>

      <div className="mt-6 grid grid-cols-3 gap-3 border border-line p-4 transition hover:border-line-strong">
        <Stat label="Documents" value={counts.documents} />
        <Stat label="Notes" value={Math.max(home.notes.length, counts.notes)} />
        <Stat label="URLs" value={counts.urls} />
      </div>

      {panel === "upload" && (
        <form onSubmit={onUpload} className="workspace-panel-enter mt-8 space-y-3 border border-line p-4">
          <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-chronos">
            Upload · PDF · Markdown · TXT
          </div>
          <input
            type="file"
            accept=".pdf,.md,.markdown,.txt,text/plain,text/markdown,application/pdf"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="block w-full text-sm text-ink-dim file:mr-3 file:rounded-full file:border-0 file:bg-chronos/20 file:px-3 file:py-1.5 file:text-chronos"
          />
          <textarea
            value={paste}
            onChange={(e) => setPaste(e.target.value)}
            rows={3}
            placeholder="Optional: paste excerpts (recommended for PDFs so they become searchable)"
            className="w-full rounded-lg border border-line bg-bg px-3 py-2 text-sm text-ink focus:border-chronos focus:outline-none"
          />
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={busy}
              className="rounded-full bg-ink px-4 py-2 text-sm text-bg hover:bg-chronos disabled:opacity-50"
            >
              {busy ? "Saving…" : "Add to library"}
            </button>
            <button
              type="button"
              onClick={() => openPanel(null)}
              className="rounded-full border border-line px-4 py-2 text-sm text-ink-dim"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {panel === "import" && (
        <form onSubmit={onImport} className="workspace-panel-enter mt-8 space-y-3 border border-line p-4">
          <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-chronos">
            Import
          </div>
          <div className="flex gap-2">
            <ModeChip
              label="Website"
              active={importMode === "website"}
              onClick={() => setImportMode("website")}
            />
            <ModeChip
              label="GitHub README"
              active={importMode === "github"}
              onClick={() => setImportMode("github")}
            />
          </div>
          <input
            required
            type="url"
            value={importUrl}
            onChange={(e) => setImportUrl(e.target.value)}
            placeholder={
              importMode === "github"
                ? "https://github.com/owner/repo"
                : "https://example.com/docs"
            }
            className="w-full rounded-lg border border-line bg-bg px-3 py-2 text-sm text-ink focus:border-chronos focus:outline-none"
          />
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={busy}
              className="rounded-full bg-ink px-4 py-2 text-sm text-bg hover:bg-chronos disabled:opacity-50"
            >
              {busy ? "Importing…" : "Import"}
            </button>
            <button
              type="button"
              onClick={() => openPanel(null)}
              className="rounded-full border border-line px-4 py-2 text-sm text-ink-dim"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {err && <p className="mt-4 text-sm text-red-400">{err}</p>}

      {justSaved && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-chronos/30 bg-chronos/5 px-4 py-3">
          <p className="text-sm text-ink-dim">
            Context saved. Run a simulation to rank futures against your goal.
          </p>
          <div className="flex items-center gap-3">
            <Link
              to="/workspace/simulations?new=1"
              className="rounded-full bg-ink px-4 py-2 text-[13px] font-medium text-bg transition hover:bg-chronos"
            >
              Run simulation
            </Link>
            <button
              type="button"
              onClick={() => setJustSaved(false)}
              className="text-[12px] text-ink-faint hover:text-ink"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      <ul className="mt-8 divide-y divide-line border-y border-line">
        {hits.length === 0 ? (
          <li className="py-6 text-sm text-ink-dim">
            {query ? (
              "No matches."
            ) : (
              <>
                Library is empty. Upload a file, import a URL, or{" "}
                <Link to="/workspace/notes?new=1" className="text-chronos">
                  create a note
                </Link>
                .
              </>
            )}
          </li>
        ) : (
          hits.map((hit) => (
            <li key={`${hit.kind}-${hit.id}`}>
              <button
                type="button"
                onClick={() => setSelected(hit)}
                className="flex w-full flex-col items-start gap-1 py-4 text-left transition hover:text-chronos"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint">
                    {hit.type}
                  </span>
                  {query && hit.score > 0 && (
                    <span className="font-mono text-[10px] text-chronos">match {hit.score}</span>
                  )}
                </div>
                <span className="text-[15px] text-ink">{hit.title}</span>
                {hit.content ? (
                  <span className="text-sm text-ink-dim">{snippet(hit.content)}</span>
                ) : null}
              </button>
            </li>
          ))
        )}
      </ul>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center">
          <div className="max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-line bg-bg p-5 shadow-xl">
            <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint">
              {selected.type}
            </div>
            <h2 className="mt-2 font-serif text-2xl text-ink">{selected.title}</h2>
            <pre className="mt-4 whitespace-pre-wrap font-sans text-sm text-ink-dim">
              {selected.content || "No content"}
            </pre>
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="mt-6 rounded-full border border-line px-4 py-2 text-sm text-ink"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function NotesPage() {
  const { home, addNote, error } = useWorkspace();
  const [params, setParams] = useSearchParams();
  const isNew = params.get("new") === "1";
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);

  const notes = home?.notes ?? [];
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return notes;
    return notes.filter(
      (n) => n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q)
    );
  }, [notes, query]);

  if (!home) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await addNote(title, content);
      setTitle("");
      setContent("");
      setParams({});
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="ws-cascade">
      <div className="header-enter flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-faint">Notes</div>
          <h1 className="mt-2 font-serif text-3xl text-ink">Working notes</h1>
        </div>
        {!isNew && (
          <button
            type="button"
            onClick={() => setParams({ new: "1" })}
            className="rounded-full border border-line px-3 py-1.5 text-sm text-ink transition hover:border-chronos/50 hover:text-chronos"
          >
            + Note
          </button>
        )}
      </div>

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search notes · title · content"
        className="mt-6 w-full rounded-lg border border-line bg-bg px-3 py-2.5 text-sm text-ink transition focus:border-chronos focus:outline-none"
      />

      {isNew && (
        <form onSubmit={submit} className="workspace-panel-enter mt-8 space-y-4 border border-line p-4">
          <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-chronos">
            Markdown note
          </div>
          <MarkdownNoteEditor
            title={title}
            content={content}
            onTitleChange={setTitle}
            onContentChange={setContent}
          />
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={busy}
              className="rounded-full bg-ink px-4 py-2 text-sm text-bg hover:bg-chronos disabled:opacity-50"
            >
              {busy ? "Saving…" : "Save note"}
            </button>
            <button
              type="button"
              onClick={() => setParams({})}
              className="rounded-full border border-line px-4 py-2 text-sm text-ink-dim"
            >
              Cancel
            </button>
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
        </form>
      )}

      <ul className="mt-8 space-y-3">
        {filtered.length === 0 ? (
          <li className="text-sm text-ink-dim">{query ? "No matching notes." : "No notes yet."}</li>
        ) : (
          filtered.map((note) => (
            <li key={note.id} className="border border-line px-4 py-4">
              <h2 className="text-ink">{note.title}</h2>
              <div
                className="prose-lite mt-2 text-sm text-ink-dim"
                dangerouslySetInnerHTML={{
                  __html: renderSimpleMarkdown(note.content || "_Empty_"),
                }}
              />
            </li>
          ))
        )}
      </ul>
      <style>{`
        .prose-lite h1 { font-family: Instrument Serif, serif; font-size: 1.5rem; color: #e2ddda; margin: 0.5rem 0; }
        .prose-lite h2 { font-family: Instrument Serif, serif; font-size: 1.25rem; color: #e2ddda; margin: 0.5rem 0; }
        .prose-lite h3 { font-size: 1rem; color: #e2ddda; margin: 0.4rem 0; }
        .prose-lite p { margin: 0.35rem 0; }
        .prose-lite ul { margin: 0.35rem 0 0.35rem 1.1rem; list-style: disc; }
        .prose-lite code { font-family: JetBrains Mono, monospace; font-size: 0.85em; color: #60899b; }
        .prose-lite a { color: #60899b; text-decoration: underline; }
        .prose-lite strong { color: #e2ddda; }
      `}</style>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="font-serif text-2xl text-ink">{value}</div>
      <div className="mt-1 font-mono text-[9px] uppercase tracking-[0.16em] text-ink-faint">
        {label}
      </div>
    </div>
  );
}

function ActionButton({
  label,
  onClick,
  active,
}: {
  label: string;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-sm transition ${
        active
          ? "border-chronos/50 bg-chronos/10 text-chronos"
          : "border-line text-ink hover:border-chronos/50 hover:text-chronos"
      }`}
    >
      {label}
    </button>
  );
}

function ModeChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1 text-xs transition ${
        active ? "bg-chronos/20 text-chronos" : "bg-bg text-ink-dim hover:text-ink"
      }`}
    >
      {label}
    </button>
  );
}
