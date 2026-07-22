import { useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  confidencePercent,
  formatCreatedAt,
} from "../../../domain/workspace/seed";
import type { SimulationTaskRecord } from "../../../domain/workspace/types";
import { buildDecisionReport } from "../../../domain/workspace/decisionReport";
import { FutureTimelineCards } from "../timeline/FutureTimelineCards";
import { useWorkspace } from "../workspace/WorkspaceContext";
import { DecisionReportCard } from "./components/DecisionReportCard";
import { FutureComparison } from "./components/FutureComparison";
import { OutcomeTracking } from "./components/OutcomeTracking";

export function SimulationsPage() {
  const { home, runSimulation, error } = useWorkspace();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const hasRuns = (home?.recentSimulations.length ?? 0) > 0;
  // Open the run form for first-time users even without ?new=1
  const isNew = params.get("new") === "1" || (!hasRuns && params.get("new") !== "0");
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
      const simId = await runSimulation(objective, lines);
      setParams({});
      // Land on the decision report + timeline — not the bare list
      navigate(simId ? `/workspace/simulations/${simId}` : "/workspace/simulations");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-faint">
            Simulation engine
          </div>
          <h1 className="mt-2 font-serif text-3xl text-ink">Simulations</h1>
          <p className="mt-2 max-w-xl text-sm text-ink-dim">
            Generate multiple futures, compare trade-offs, get a decision report — then save the path.
          </p>
        </div>
        {!isNew && (
          <Link
            to="/workspace/simulations?new=1"
            className="rounded-full bg-ink px-4 py-2 text-sm font-medium text-bg transition hover:bg-chronos"
          >
            Run simulation
          </Link>
        )}
      </div>

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

          <Field label="What should Chronos decide?">
            <input
              required
              aria-label="What should Chronos decide?"
              value={objective}
              onChange={(e) => setObjective(e.target.value)}
              placeholder="e.g. How should we launch with a small team and limited runway?"
              className="w-full rounded-lg border border-line bg-bg px-3 py-2 text-sm text-ink focus:border-chronos focus:outline-none"
            />
          </Field>

          <Field label="Knowledge (from library)">
            {knowledgePreview.length === 0 ? (
              <div className="rounded-lg border border-chronos/25 bg-chronos/5 p-3 text-sm text-ink-dim">
                No knowledge yet.{" "}
                <Link to="/workspace/knowledge" className="text-chronos underline-offset-2 hover:underline">
                  Add one source
                </Link>{" "}
                for better ranking — you can still run without it.
              </div>
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

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="submit"
              disabled={busy}
              className="rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-bg transition hover:bg-chronos disabled:opacity-50"
            >
              {busy ? "Generating futures…" : "Generate futures"}
            </button>
            {hasRuns && (
              <button
                type="button"
                onClick={() => setParams({})}
                className="rounded-full border border-line px-4 py-2.5 text-sm text-ink-dim"
              >
                Cancel
              </button>
            )}
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
        </form>
      )}

      <div className="mt-8 -mx-1 overflow-x-auto border-y border-line px-1">
        <table className="w-full min-w-[480px] text-left text-sm sm:min-w-[520px]">
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
                  No runs yet. Use the form above to run your first simulation.
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
  const {
    home,
    rerunSimulation,
    chooseBestPath,
    recordOutcomeFollowed,
    recordOutcomeResult,
  } = useWorkspace();
  const { simulationId } = useParams();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const sim = home?.recentSimulations.find((s) => s.id === simulationId);
  const futures = simulationId ? home?.futuresBySimulation[simulationId] ?? [] : [];
  const [rerunning, setRerunning] = useState(false);
  const [selectedFutureId, setSelectedFutureId] = useState<string | null>(null);

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

  const wantsRerun = params.get("rerun") === "1";
  const decisionReport =
    sim.status === "completed" ? buildDecisionReport(home, sim, futures) : null;
  const chosenId =
    typeof sim.result.chosen_future_id === "string" ? sim.result.chosen_future_id : null;
  const activeFutureId = selectedFutureId ?? chosenId ?? futures[0]?.id ?? null;

  return (
    <div className="space-y-10">
      <div>
        <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-faint">
          Simulation · {home.workspace.name}
        </div>
        <h1 className="mt-2 font-serif text-3xl text-ink">{sim.title}</h1>
        <p className="mt-2 max-w-2xl text-sm text-ink-dim">
          Compare futures → read the decision report → choose a path and save it to the timeline.
        </p>
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
            to="/workspace/timeline"
            className="rounded-full border border-line px-4 py-2 text-sm text-ink hover:border-chronos/50 hover:text-chronos"
          >
            Timeline
          </Link>
        </div>

        {wantsRerun && (
          <p className="mt-3 text-sm text-ink-dim">
            Re-run creates the next version (v{(sim.version || 1) + 1}) with current knowledge.{" "}
            <button type="button" onClick={handleRerun} className="text-chronos underline">
              Confirm re-run
            </button>
          </p>
        )}

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

      {/* 1 · Compare outcomes — the Chronos wow moment */}
      <FutureComparison
        futures={futures}
        chosenFutureId={chosenId}
        selectedId={activeFutureId}
        onSelect={setSelectedFutureId}
      />

      {/* 2 · Decision report (shareable artifact) */}
      {decisionReport && (
        <DecisionReportCard
          report={decisionReport}
          outcomeSlot={
            <OutcomeTracking
              pathSaved={Boolean(chosenId)}
              followed={decisionReport.outcomeFollowed}
              followedAt={decisionReport.outcomeFollowedAt}
              result={decisionReport.outcomeResult}
              resultAt={decisionReport.outcomeResultAt}
              recommendedName={decisionReport.recommended}
              onFollowed={(followed) => recordOutcomeFollowed(sim.id, followed)}
              onResult={(note) => recordOutcomeResult(sim.id, note)}
            />
          }
        />
      )}

      {/* 3 · Choose path · Save timeline */}
      <FutureTimelineCards
        goalTitle={home.goal?.title ?? sim.title}
        futures={futures}
        simulationRisks={risks}
        chosenFutureId={chosenId}
        selectedId={activeFutureId}
        onSelect={setSelectedFutureId}
        onChoosePath={async (futureId) => {
          await chooseBestPath(sim.id, futureId);
          setSelectedFutureId(futureId);
        }}
      />

      {/* Engine pipeline — secondary detail after the decision loop */}
      <details className="rounded-2xl border border-line">
        <summary className="cursor-pointer list-none px-4 py-3 font-mono text-[10px] uppercase tracking-[0.22em] text-ink-faint marker:content-none [&::-webkit-details-marker]:hidden">
          Engine pipeline · {tasks.length || 5} steps
        </summary>
        <ol className="space-y-2 border-t border-line px-4 py-4">
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
      </details>

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
