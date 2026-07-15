import { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { confidencePercent, knowledgeCounts } from "../../../domain/workspace/seed";
import type { KnowledgeType } from "../../../domain/workspace/types";
import { useWorkspace } from "./WorkspaceContext";

function PageFrame({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-faint">{eyebrow}</div>
      <h1 className="mt-2 font-serif text-3xl text-ink">{title}</h1>
      <div className="mt-8">{children}</div>
    </div>
  );
}

export function WorkspaceKnowledgePage() {
  const { home, addKnowledge, error } = useWorkspace();
  const [params, setParams] = useSearchParams();
  const wantUpload = params.get("upload") === "1";
  const wantImport = params.get("import") === "website";
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [url, setUrl] = useState("https://");
  const [busy, setBusy] = useState(false);

  if (!home) return null;
  const counts = knowledgeCounts(home.knowledge);

  const submitUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const type: KnowledgeType = title.toLowerCase().endsWith(".pdf") ? "pdf" : "research";
      await addKnowledge({ type, title, content });
      setTitle("");
      setContent("");
      setParams({});
    } finally {
      setBusy(false);
    }
  };

  const submitImport = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const trimmed = url.trim();
      await addKnowledge({
        type: "website",
        title: trimmed,
        metadata: { url: trimmed },
      });
      setUrl("https://");
      setParams({});
    } finally {
      setBusy(false);
    }
  };

  return (
    <PageFrame eyebrow="Knowledge" title="Library">
      {wantUpload && (
        <form onSubmit={submitUpload} className="mb-8 space-y-3 border border-line p-4">
          <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-chronos">
            Upload context
          </div>
          <input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Kickstart brief.pdf"
            className="w-full rounded-lg border border-line bg-bg px-3 py-2 text-sm text-ink focus:border-chronos focus:outline-none"
          />
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={3}
            placeholder="Paste key excerpts or notes from the doc"
            className="w-full rounded-lg border border-line bg-bg px-3 py-2 text-sm text-ink focus:border-chronos focus:outline-none"
          />
          <button
            type="submit"
            disabled={busy}
            className="rounded-full bg-ink px-4 py-2 text-sm text-bg hover:bg-chronos disabled:opacity-50"
          >
            {busy ? "Saving…" : "Add to library"}
          </button>
        </form>
      )}

      {wantImport && (
        <form onSubmit={submitImport} className="mb-8 space-y-3 border border-line p-4">
          <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-chronos">
            Import URL
          </div>
          <input
            required
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com"
            className="w-full rounded-lg border border-line bg-bg px-3 py-2 text-sm text-ink focus:border-chronos focus:outline-none"
          />
          <button
            type="submit"
            disabled={busy}
            className="rounded-full bg-ink px-4 py-2 text-sm text-bg hover:bg-chronos disabled:opacity-50"
          >
            {busy ? "Saving…" : "Import"}
          </button>
        </form>
      )}

      {error && <p className="mb-4 text-sm text-red-400">{error}</p>}

      <div className="space-y-3 border-y border-line divide-y divide-line">
        <CountRow label="PDFs" value={counts.pdfs} />
        <CountRow label="Notes" value={home.notes.length} />
        <CountRow label="Websites" value={counts.websites} />
        <CountRow label="Research docs" value={counts.research} />
      </div>

      <ul className="mt-8 space-y-3">
        {home.knowledge.length === 0 ? (
          <li className="text-sm text-ink-dim">No context yet. Upload a doc or import a URL.</li>
        ) : (
          home.knowledge.map((item) => (
            <li key={item.id} className="border border-line px-4 py-3">
              <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint">
                {item.type}
              </div>
              <div className="mt-1 text-ink">{item.title}</div>
              {item.content ? <p className="mt-2 text-sm text-ink-dim line-clamp-2">{item.content}</p> : null}
            </li>
          ))
        )}
      </ul>
    </PageFrame>
  );
}

export function WorkspaceSimulationsPage() {
  const { home, runSimulation, error } = useWorkspace();
  const [params, setParams] = useSearchParams();
  const isNew = params.get("new") === "1";
  const [objective, setObjective] = useState(home?.goal?.title ?? "");
  const [busy, setBusy] = useState(false);

  if (!home) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await runSimulation(objective);
      setParams({});
    } finally {
      setBusy(false);
    }
  };

  return (
    <PageFrame eyebrow="Simulations" title="All runs">
      {isNew && (
        <form onSubmit={submit} className="mb-8 space-y-3 border border-line p-4">
          <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-chronos">
            New simulation
          </div>
          <input
            required
            value={objective}
            onChange={(e) => setObjective(e.target.value)}
            placeholder="Should we raise funding?"
            className="w-full rounded-lg border border-line bg-bg px-3 py-2 text-sm text-ink focus:border-chronos focus:outline-none"
          />
          <button
            type="submit"
            disabled={busy}
            className="rounded-full bg-ink px-4 py-2 text-sm text-bg hover:bg-chronos disabled:opacity-50"
          >
            {busy ? "Simulating…" : "Run simulation"}
          </button>
          {error && <p className="text-sm text-red-400">{error}</p>}
        </form>
      )}

      <ul className="divide-y divide-line border-y border-line">
        {home.recentSimulations.length === 0 ? (
          <li className="py-6 text-sm text-ink-dim">No runs yet.</li>
        ) : (
          home.recentSimulations.map((sim) => (
            <li key={sim.id}>
              <Link
                to={`/workspace/simulations/${sim.id}`}
                className="flex items-start justify-between gap-4 py-4 hover:text-chronos"
              >
                <div>
                  <div className="text-ink">{sim.title}</div>
                  <div className="mt-1 text-sm text-ink-dim">
                    {sim.futures_count} futures
                    {sim.best_outcome ? ` · ${sim.best_outcome}` : ""}
                  </div>
                </div>
                <span className="font-mono text-[12px] text-chronos">
                  {confidencePercent(sim.confidence)}
                </span>
              </Link>
            </li>
          ))
        )}
      </ul>
      <BackLink to="/workspace" label="Dashboard" />
    </PageFrame>
  );
}

export function WorkspaceSimulationDetailPage() {
  const { home } = useWorkspace();
  const { simulationId } = useParams();
  const sim = home?.recentSimulations.find((item) => item.id === simulationId);

  if (!home) return null;

  if (!sim) {
    return (
      <PageFrame eyebrow="Simulations" title="Not found">
        <p className="text-sm text-ink-dim">This simulation is not in the workspace.</p>
        <BackLink to="/workspace/simulations" label="All simulations" />
      </PageFrame>
    );
  }

  return (
    <PageFrame eyebrow="Simulation" title={sim.title}>
      <dl className="space-y-4 border-y border-line py-4">
        <Detail label="Status" value={sim.status} />
        <Detail label="Futures" value={String(sim.futures_count)} />
        <Detail label="Best outcome" value={sim.best_outcome ?? "—"} />
        <Detail label="Confidence" value={confidencePercent(sim.confidence)} />
        <Detail label="Created" value={new Date(sim.created_at).toLocaleString()} />
      </dl>
      <BackLink to="/workspace/simulations" label="All simulations" />
    </PageFrame>
  );
}

export function WorkspaceNotesPage() {
  const { home, addNote, error } = useWorkspace();
  const [params, setParams] = useSearchParams();
  const isNew = params.get("new") === "1";
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState(false);

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
    <PageFrame eyebrow="Notes" title="Working notes">
      {isNew && (
        <form onSubmit={submit} className="mb-8 space-y-3 border border-line p-4">
          <input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Note title"
            className="w-full rounded-lg border border-line bg-bg px-3 py-2 text-sm text-ink focus:border-chronos focus:outline-none"
          />
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={4}
            placeholder="What did you learn?"
            className="w-full rounded-lg border border-line bg-bg px-3 py-2 text-sm text-ink focus:border-chronos focus:outline-none"
          />
          <button
            type="submit"
            disabled={busy}
            className="rounded-full bg-ink px-4 py-2 text-sm text-bg hover:bg-chronos disabled:opacity-50"
          >
            {busy ? "Saving…" : "Save note"}
          </button>
          {error && <p className="text-sm text-red-400">{error}</p>}
        </form>
      )}

      <ul className="space-y-3">
        {home.notes.length === 0 ? (
          <li className="text-sm text-ink-dim">No notes yet.</li>
        ) : (
          home.notes.map((note) => (
            <li key={note.id} className="border border-line px-4 py-4">
              <h2 className="text-ink">{note.title}</h2>
              <p className="mt-2 text-sm text-ink-dim whitespace-pre-wrap">{note.content}</p>
            </li>
          ))
        )}
      </ul>
    </PageFrame>
  );
}

export function WorkspaceSettingsPage() {
  const { home } = useWorkspace();
  if (!home) return null;

  return (
    <PageFrame eyebrow="Settings" title="Workspace">
      <dl className="space-y-4 border-y border-line py-4">
        <Detail label="Name" value={home.workspace.name} />
        <Detail label="Id" value={home.workspace.id} />
        <Detail label="Goal" value={home.goal?.title ?? "—"} />
        <Detail label="Goal status" value={home.goal?.status ?? "—"} />
        <Detail label="Simulations" value={String(home.recentSimulations.length)} />
        <Detail label="Knowledge items" value={String(home.knowledge.length)} />
        <Detail label="Notes" value={String(home.notes.length)} />
      </dl>
      <p className="mt-4 text-sm text-ink-dim">
        Progress is saved in this browser so you can return and continue. Cloud sync uses the
        workspace tables once migrations are applied.
      </p>
    </PageFrame>
  );
}

function CountRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between py-3 text-sm">
      <span className="text-ink-dim">{label}</span>
      <span className="text-ink">{value}</span>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <dt className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint">{label}</dt>
      <dd className="text-sm text-ink">{value}</dd>
    </div>
  );
}

function BackLink({ to, label }: { to: string; label: string }) {
  return (
    <Link
      to={to}
      className="mt-8 inline-flex font-mono text-[11px] uppercase tracking-[0.16em] text-ink-dim transition hover:text-chronos"
    >
      ← {label}
    </Link>
  );
}
