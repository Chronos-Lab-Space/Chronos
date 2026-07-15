import { useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  confidencePercent,
  formatCreatedAt,
} from "../../../domain/workspace/seed";
import type { SimulationTaskRecord } from "../../../domain/workspace/types";
import { workspaceGrokService } from "../../../application/workspace/WorkspaceGrokService";
import { FutureTimelineCards } from "../timeline/FutureTimelineCards";
import { useWorkspace } from "../workspace/WorkspaceContext";

export function SimulationsPage() {
  const { home, runSimulation, error } = useWorkspace();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const isNew = params.get("new") === "1";
  const [objective, setObjective] = useState(home?.goal?.title ?? "");
  const [constraints, setConstraints] = useState("");
  const [busy, setBusy] = useState(false);

  if (!home) return null;

  const knowledgePreview = home.knowledge.slice(0, 5);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const lines = constraints
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);
      await runSimulation(objective, lines);
      setParams({});
      navigate("/workspace/simulations");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-faint">
        Simulation engine
      </div>
      <h1 className="mt-2 font-serif text-3xl text-ink">Simulations</h1>
      <p className="mt-2 max-w-xl text-sm text-ink-dim">
        Planner → Generate futures → Evaluate → Rank → Best future. Inputs: goal, knowledge,
        constraints.
      </p>

      {isNew && (
        <form onSubmit={onSubmit} className="mt-8 space-y-4 border border-line p-4">
          <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-chronos">
            Run simulation
          </div>

          <Field label="Goal">
            <div className="rounded-lg border border-line bg-bg px-3 py-2 text-sm text-ink">
              {home.goal?.title ?? "No active goal"}
            </div>
          </Field>

          <Field label="Objective">
            <input
              required
              value={objective}
              onChange={(e) => setObjective(e.target.value)}
              placeholder="Should we raise funding before Kickstart?"
              className="w-full rounded-lg border border-line bg-bg px-3 py-2 text-sm text-ink focus:border-chronos focus:outline-none"
            />
          </Field>

          <Field label="Knowledge (from library)">
            {knowledgePreview.length === 0 ? (
              <p className="text-sm text-ink-dim">
                No knowledge yet.{" "}
                <Link to="/workspace/knowledge" className="text-chronos">
                  Add context
                </Link>{" "}
                for better ranking.
              </p>
            ) : (
              <ul className="space-y-1 text-sm text-ink-dim">
                {knowledgePreview.map((k) => (
                  <li key={k.id}>
                    <span className="font-mono text-[10px] uppercase text-ink-faint">{k.type}</span>{" "}
                    {k.title}
                  </li>
                ))}
                {home.knowledge.length > 5 && (
                  <li className="text-ink-faint">+{home.knowledge.length - 5} more</li>
                )}
              </ul>
            )}
          </Field>

          <Field label="Constraints (one per line)">
            <textarea
              value={constraints}
              onChange={(e) => setConstraints(e.target.value)}
              rows={3}
              placeholder={"must keep 12 months runway\nno raise before launch\nprefer bootstrap"}
              className="w-full rounded-lg border border-line bg-bg px-3 py-2 font-mono text-[13px] text-ink focus:border-chronos focus:outline-none"
            />
            <p className="mt-1 text-xs text-ink-faint">
              Lines starting with must/hard/required/no/never are treated as hard constraints.
            </p>
          </Field>

          <button
            type="submit"
            disabled={busy}
            className="rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-bg transition hover:bg-chronos disabled:opacity-50"
          >
            {busy ? "Running engine…" : "Run engine"}
          </button>
          {error && <p className="text-sm text-red-400">{error}</p>}
        </form>
      )}

      <div className="mt-8 overflow-x-auto border-y border-line">
        <table className="w-full min-w-[520px] text-left text-sm">
          <thead>
            <tr className="border-b border-line font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint">
              <th className="py-3 pr-3 font-medium">Name</th>
              <th className="py-3 pr-3 font-medium">Status</th>
              <th className="py-3 pr-3 font-medium">Confidence</th>
              <th className="py-3 font-medium">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {home.recentSimulations.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-6 text-ink-dim">
                  No runs yet.{" "}
                  <Link to="/workspace/simulations?new=1" className="text-chronos">
                    Run the engine
                  </Link>
                  .
                </td>
              </tr>
            ) : (
              home.recentSimulations.map((sim) => (
                <tr key={sim.id}>
                  <td className="py-3 pr-3">
                    <Link to={`/workspace/simulations/${sim.id}`} className="hover:text-chronos">
                      {sim.title}
                    </Link>
                  </td>
                  <td className="py-3 pr-3">
                    <StatusPill status={sim.status} />
                  </td>
                  <td className="py-3 pr-3 font-mono text-chronos">
                    {confidencePercent(sim.confidence)}
                  </td>
                  <td className="py-3 text-ink-dim">{formatCreatedAt(sim.created_at)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <Back to="/workspace" label="Dashboard" />
    </div>
  );
}

export function SimulationDetailPage() {
  const { home, rerunSimulation } = useWorkspace();
  const { simulationId } = useParams();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const sim = home?.recentSimulations.find((s) => s.id === simulationId);
  const futures = simulationId ? home?.futuresBySimulation[simulationId] ?? [] : [];
  const [rerunning, setRerunning] = useState(false);
  const [grokBusy, setGrokBusy] = useState(false);
  const [grokBrief, setGrokBrief] = useState<string | null>(null);
  const [grokError, setGrokError] = useState<string | null>(null);

  const tasks = useMemo(() => {
    const raw = sim?.result.tasks;
    return Array.isArray(raw) ? (raw as SimulationTaskRecord[]) : [];
  }, [sim]);

  const risks = useMemo(() => {
    const raw = sim?.result.risks;
    return Array.isArray(raw) ? (raw as string[]) : [];
  }, [sim]);

  const versions = useMemo(() => {
    if (!home || !sim) return [];
    const lineage = sim.lineage_id || sim.id;
    return home.recentSimulations
      .filter((s) => (s.lineage_id || s.id) === lineage)
      .sort((a, b) => a.version - b.version);
  }, [home, sim]);

  if (!home) return null;
  if (!sim) {
    return (
      <div>
        <h1 className="font-serif text-3xl text-ink">Not found</h1>
        <Back to="/workspace/simulations" label="All simulations" />
      </div>
    );
  }

  const recommendation =
    typeof sim.result.recommendation === "string"
      ? sim.result.recommendation
      : sim.result.thesis
        ? String(sim.result.thesis)
        : "—";

  const handleRerun = async () => {
    setRerunning(true);
    try {
      const newId = await rerunSimulation(sim.id);
      setParams({});
      if (newId) navigate(`/workspace/simulations/${newId}`);
    } finally {
      setRerunning(false);
    }
  };

  const handleGrokEnhance = async () => {
    setGrokBusy(true);
    setGrokError(null);
    try {
      const brief = await workspaceGrokService.enhanceSimulationReport(home, sim.id);
      setGrokBrief(brief);
    } catch (err) {
      setGrokError((err as Error).message);
    } finally {
      setGrokBusy(false);
    }
  };

  const wantsRerun = params.get("rerun") === "1";

  return (
    <div className="space-y-10">
      <div>
        <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-faint">
          Report · {home.workspace.name}
        </div>
        <h1 className="mt-2 font-serif text-3xl text-ink">{sim.title}</h1>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <StatusPill status={sim.status} />
          <span className="rounded-full bg-chronos/15 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-chronos">
            v{sim.version}
          </span>
          <span className="font-mono text-sm text-chronos">
            Confidence {confidencePercent(sim.confidence)}
          </span>
          <span className="text-sm text-ink-dim">{formatCreatedAt(sim.created_at)}</span>
        </div>

        {/* Memory actions */}
        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleRerun}
            disabled={rerunning}
            className="rounded-full bg-ink px-4 py-2 text-sm text-bg transition hover:bg-chronos disabled:opacity-50"
          >
            {rerunning ? "Re-running…" : "Re-run"}
          </button>
          {versions.length >= 2 && (
            <Link
              to={`/workspace/memory/compare?a=${versions[0].id}&b=${sim.id}`}
              className="rounded-full border border-line px-4 py-2 text-sm text-ink hover:border-chronos/50 hover:text-chronos"
            >
              Compare versions
            </Link>
          )}
          <Link
            to="/workspace/memory"
            className="rounded-full border border-line px-4 py-2 text-sm text-ink-dim hover:text-ink"
          >
            Memory
          </Link>
          <button
            type="button"
            onClick={() => void handleGrokEnhance()}
            disabled={grokBusy}
            className="rounded-full border border-chronos/40 px-4 py-2 text-sm text-chronos transition hover:bg-chronos/10 disabled:opacity-50"
          >
            {grokBusy ? "Grok…" : "Enhance with Grok"}
          </button>
        </div>

        {grokError && <p className="mt-3 text-sm text-red-400">{grokError}</p>}
        {grokBrief && (
          <div className="mt-4 rounded-xl border border-chronos/30 bg-chronos/5 p-4">
            <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-chronos">
              Grok brief
            </div>
            <div className="mt-2 whitespace-pre-wrap text-sm text-ink-dim">{grokBrief}</div>
          </div>
        )}

        {wantsRerun && (
          <p className="mt-3 text-sm text-ink-dim">
            Re-run creates the next version (v{(sim.version || 1) + 1}) with current knowledge.{" "}
            <button type="button" onClick={handleRerun} className="text-chronos underline">
              Confirm re-run
            </button>
          </p>
        )}

        {/* Version strip */}
        {versions.length > 0 && (
          <ol className="mt-5 flex flex-wrap gap-2">
            {versions.map((v) => (
              <li key={v.id}>
                <Link
                  to={`/workspace/simulations/${v.id}`}
                  className={`inline-flex rounded-full px-3 py-1 font-mono text-[11px] ${
                    v.id === sim.id
                      ? "bg-chronos/20 text-chronos"
                      : "bg-bg text-ink-dim hover:text-chronos"
                  }`}
                >
                  v{v.version}
                </Link>
              </li>
            ))}
          </ol>
        )}
      </div>

      {/* Pipeline tasks */}
      <section>
        <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-faint">
          Engine pipeline
        </div>
        <ol className="mt-4 space-y-2">
          {(tasks.length
            ? tasks
            : [
                { id: "1", title: "Planner", status: sim.status, phase: "plan" as const },
                { id: "2", title: "Generate futures", status: sim.status, phase: "generate" as const },
                { id: "3", title: "Evaluate", status: sim.status, phase: "evaluate" as const },
                { id: "4", title: "Rank", status: sim.status, phase: "rank" as const },
                { id: "5", title: "Best future", status: sim.status, phase: "collapse" as const },
              ]
          ).map((task, index) => (
            <li
              key={task.id}
              className="flex items-center justify-between gap-3 border border-line px-3 py-2.5 text-sm"
            >
              <span className="text-ink">
                <span className="mr-2 font-mono text-[10px] text-ink-faint">
                  {String(index + 1).padStart(2, "0")}
                </span>
                {task.title}
              </span>
              <StatusPill status={task.status} />
            </li>
          ))}
        </ol>
      </section>

      {/* Best recommendation */}
      <section className="border border-chronos/30 bg-chronos/5 p-5">
        <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-chronos">
          Best recommendation
        </div>
        <p className="mt-3 text-lg text-ink">{recommendation}</p>
        <div className="mt-4 flex flex-wrap gap-4 text-sm">
          <span className="text-ink-dim">
            Top future:{" "}
            <span className="text-ink">{String(sim.result.best_future ?? "—")}</span>
          </span>
          <span className="font-mono text-chronos">
            {confidencePercent(sim.confidence)}
          </span>
        </div>
      </section>

      {/* Phase 5 — card timeline */}
      <FutureTimelineCards
        goalTitle={home.goal?.title ?? sim.title}
        futures={futures}
        simulationRisks={risks}
      />

      <Back to="/workspace/simulations" label="All simulations" />
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const tone =
    status === "completed"
      ? "bg-chronos/15 text-chronos"
      : status === "running"
        ? "bg-accent-2/15 text-accent-2"
        : status === "failed"
          ? "bg-red-500/15 text-red-400"
          : "bg-bg text-ink-dim";
  return (
    <span className={`rounded-full px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] ${tone}`}>
      {status}
    </span>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint">
        {label}
      </div>
      {children}
    </div>
  );
}

function Back({ to, label }: { to: string; label: string }) {
  return (
    <Link
      to={to}
      className="mt-8 inline-flex font-mono text-[11px] uppercase tracking-[0.16em] text-ink-dim hover:text-chronos"
    >
      ← {label}
    </Link>
  );
}
