import { useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { assessObjectiveScope } from "../../../domain/chronos/objectiveScope";
import { confidencePercent, formatCreatedAt } from "../../../domain/workspace/seed";
import type { SimulationTaskRecord } from "../../../domain/workspace/types";
import { decisionIdForSimulation } from "../../../domain/workspace/decision";
import { buildDecisionGraph } from "../../../domain/workspace/decisionGraph";
import { buildDecisionReport } from "../../../domain/workspace/decisionReport";
import { groupSimulationsByHistory } from "../../../domain/workspace/simulationHistory";
import { FutureTimelineCards } from "../timeline/FutureTimelineCards";
import { ContextPrompt } from "../workspace/ContextPrompt";
import { useWorkspace } from "../workspace/WorkspaceContext";
import { DecisionGraphPanel } from "./components/DecisionGraphPanel";
import { DecisionPipelineStrip } from "./components/DecisionPipelineStrip";
import { DecisionReportCard } from "./components/DecisionReportCard";
import { FutureComparison } from "./components/FutureComparison";
import { FutureGraph } from "./FutureGraph";
import { OutcomeTracking } from "./components/OutcomeTracking";
import { SurfaceLoading } from "../workspace/SurfaceLoading";

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

  if (!home) return <SurfaceLoading eyebrow="Simulation engine" title="Simulations" size="md" />;

  const knowledgePreview = home.knowledge.slice(0, 5);

  // Live, so the warning appears while typing rather than on a rejected submit.
  // Empty is "not yet answered", not "out of scope" — `required` covers that.
  const scope = assessObjectiveScope(objective);
  const outOfScope = objective.trim().length > 0 && !scope.inScope;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // The catalog is startup scenarios only. Running anyway would rank
    // "Bottom-up SaaS" against an objective it cannot model.
    if (outOfScope) return;
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
            Generate multiple futures, compare trade-offs, get a decision report — then save the
            path.
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
              aria-invalid={outOfScope}
              aria-describedby={outOfScope ? "objective-scope" : undefined}
              className="w-full rounded-lg border border-line bg-bg px-3 py-2 text-sm text-ink focus:border-chronos focus:outline-none"
            />
            {outOfScope && (
              <p
                id="objective-scope"
                role="status"
                className="mt-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm text-ink-dim"
              >
                Chronos models <strong className="text-ink">startup and business decisions</strong>{" "}
                — funding, go-to-market, pricing, hiring, product strategy. This objective does not
                look like one, and the simulator would rank go-to-market scenarios that do not fit
                it. Rephrase it as a business decision to continue.
              </p>
            )}
          </Field>

          <Field label="Knowledge (from library)">
            {knowledgePreview.length === 0 ? (
              <div className="rounded-lg border border-chronos/25 bg-chronos/5 p-3 text-sm text-ink-dim">
                No knowledge yet.{" "}
                <Link
                  to="/workspace/knowledge"
                  className="text-chronos underline-offset-2 hover:underline"
                >
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
              disabled={busy || outOfScope}
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

      <SimulationHistoryList simulations={home.recentSimulations} />
      <Back to="/workspace" label="Dashboard" />
    </div>
  );
}

/** Today · Yesterday · Last week history — product memory, not a flat table. */
function SimulationHistoryList({
  simulations,
}: {
  simulations: readonly import("../../../domain/workspace/types").SimulationRecord[];
}) {
  const buckets = useMemo(() => groupSimulationsByHistory(simulations), [simulations]);

  if (simulations.length === 0) {
    return (
      <section className="mt-8 rounded-2xl border border-dashed border-line px-5 py-8">
        <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-faint">
          Simulation history
        </div>
        <p className="mt-3 text-sm text-ink-dim">
          No runs yet. Generate futures above to produce your first decision report.
        </p>
      </section>
    );
  }

  return (
    <section className="mt-8 space-y-6">
      <div>
        <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-faint">
          Simulation history
        </div>
        <p className="mt-1 text-sm text-ink-dim">
          Reopen any run to read its decision report and saved path.
        </p>
      </div>
      {buckets.map((bucket) => (
        <div key={bucket.id}>
          <h2 className="font-mono text-[11px] uppercase tracking-[0.18em] text-chronos">
            {bucket.label}
          </h2>
          <ul className="mt-3 divide-y divide-line rounded-2xl border border-line">
            {bucket.simulations.map((sim) => (
              <li key={sim.id}>
                <Link
                  to={`/workspace/simulations/${sim.id}`}
                  className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5 transition hover:bg-bg-soft/40"
                >
                  <div className="min-w-0">
                    <div className="truncate text-[15px] text-ink">{sim.title}</div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-ink-faint">
                      <StatusPill status={sim.status} />
                      <span>v{sim.version}</span>
                      {sim.result.chosen_future_name ? (
                        <span className="text-chronos">
                          Path: {String(sim.result.chosen_future_name)}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="font-mono text-sm text-chronos">
                      {confidencePercent(sim.confidence)}
                    </div>
                    <div className="mt-0.5 text-xs text-ink-faint">
                      {formatCreatedAt(sim.created_at)}
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}

export function SimulationDetailPage() {
  const {
    home,
    rerunSimulation,
    rebranchFromOpen,
    chooseBestPath,
    recordOutcomeFollowed,
    recordOutcomeResult,
  } = useWorkspace();
  const { simulationId } = useParams();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const sim = home?.recentSimulations.find((s) => s.id === simulationId);
  const futures = simulationId ? (home?.futuresBySimulation[simulationId] ?? []) : [];
  const [rerunning, setRerunning] = useState(false);
  const [rebranching, setRebranching] = useState(false);
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

  if (!home) return <SurfaceLoading eyebrow="Simulation" title="Decision report" size="md" />;
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

  const handleRebranch = async () => {
    setRebranching(true);
    try {
      const newId = await rebranchFromOpen(sim.id);
      setParams({});
      if (newId) navigate(`/workspace/simulations/${newId}`);
    } finally {
      setRebranching(false);
    }
  };

  const wantsRerun = params.get("rerun") === "1";
  const decisionReport =
    sim.status === "completed" ? buildDecisionReport(home, sim, futures) : null;
  const chosenId =
    typeof sim.result.chosen_future_id === "string" ? sim.result.chosen_future_id : null;
  const activeFutureId = selectedFutureId ?? chosenId ?? futures[0]?.id ?? null;
  const decisionGraph =
    sim.status === "completed" && futures.length > 0 ? buildDecisionGraph(sim, futures) : null;
  const planSteps = Array.isArray(sim.result.plan_steps)
    ? sim.result.plan_steps.filter((s): s is string => typeof s === "string" && s.length > 0)
    : [];

  return (
    <div className="space-y-10">
      <div>
        <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-faint">
          Simulation · {home.workspace.name}
        </div>
        <h1 className="mt-2 font-serif text-3xl text-ink">{sim.title}</h1>
        <p className="mt-2 max-w-2xl text-sm text-ink-dim">
          Decision graph: open → branches → compare → collapse. Re-branch from open to explore again
          without losing prior branches in Memory.
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
            onClick={handleRebranch}
            disabled={rebranching || sim.status !== "completed"}
            className="rounded-full bg-ink px-4 py-2 text-sm text-bg transition hover:bg-chronos disabled:opacity-50"
          >
            {rebranching ? "Re-branching…" : "Re-branch from open"}
          </button>
          <button
            type="button"
            onClick={handleRerun}
            disabled={rerunning}
            className="rounded-full border border-line px-4 py-2 text-sm text-ink hover:border-chronos/50 hover:text-chronos disabled:opacity-50"
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
          <Link
            to="/workspace/memory"
            className="rounded-full border border-line px-4 py-2 text-sm text-ink hover:border-chronos/50 hover:text-chronos"
          >
            Memory
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

      {/* Decision pipeline — real engine phases + Decide gate */}
      <DecisionPipelineStrip
        tasks={tasks}
        simulationStatus={sim.status}
        chosenFutureId={chosenId}
        replay={sim.status === "completed"}
      />

      {/* Decision graph MVP: open → branches → collapse · re-branch */}
      {decisionGraph && (
        <DecisionGraphPanel
          graph={decisionGraph}
          selectedFutureId={activeFutureId}
          onSelectBranch={setSelectedFutureId}
          onRebranch={() => void handleRebranch()}
          rebranching={rebranching}
        />
      )}

      {/* Decision report — product contract layout */}
      {decisionReport && (
        <DecisionReportCard
          report={decisionReport}
          onSaveDecision={
            !chosenId && futures[0]
              ? async () => {
                  const id = activeFutureId ?? futures[0]!.id;
                  await chooseBestPath(sim.id, id);
                  setSelectedFutureId(id);
                }
              : undefined
          }
          onCompare={() => {
            document
              .getElementById("compare-alternatives")
              ?.scrollIntoView({ behavior: "smooth", block: "start" });
          }}
          onRerun={() => void handleRerun()}
          saveBusy={rerunning}
          outcomeSlot={
            <OutcomeTracking
              pathSaved={Boolean(chosenId)}
              followed={decisionReport.outcomeFollowed}
              followedAt={decisionReport.outcomeFollowedAt}
              result={decisionReport.outcomeResult}
              resultAt={decisionReport.outcomeResultAt}
              verdict={sim.result.outcome_verdict ?? null}
              recommendedName={decisionReport.recommended}
              onFollowed={(followed) => recordOutcomeFollowed(sim.id, followed)}
              onResult={(note, verdict) => recordOutcomeResult(sim.id, note, verdict)}
            />
          }
        />
      )}

      {/* Ask for a source now that there is a recommendation to argue with —
          not before, when it was skippable and mostly skipped. Keyed on the
          decision, not the run: re-running the same question is not a reason
          to ask again. */}
      {decisionReport && (
        <ContextPrompt
          decisionId={sim.decision_id ?? decisionIdForSimulation(sim)}
          objective={sim.title}
        />
      )}

      {/* Execution plan — steps for the path already committed to */}
      {planSteps.length > 0 && (
        <section
          data-testid="execution-plan"
          className="rounded-2xl border border-line bg-bg/50 p-5 sm:p-6"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-mono text-[10px] uppercase tracking-[0.22em] text-chronos">
              Execution plan
            </h2>
            <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint">
              {sim.result.plan_source === "ai" ? "AI-drafted" : "Draft"}
            </span>
          </div>
          <p className="mt-1 text-sm text-ink-dim">
            Steps for {String(sim.result.chosen_future_name ?? "the chosen path")}. The decision is
            already made — these do not change the ranking.
          </p>
          <ol className="mt-4 space-y-2">
            {planSteps.map((step, i) => (
              <li key={step} className="flex gap-3 text-sm text-ink">
                <span className="font-mono text-[11px] text-ink-faint">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* Future graph — signature branching visualization */}
      {sim.status === "completed" && futures.length > 0 && (
        <FutureGraph
          futures={futures}
          bestName={sim.result.best_future?.trim() || null}
          chosenFutureId={chosenId ?? null}
          selectedId={activeFutureId}
          onSelect={setSelectedFutureId}
        />
      )}

      {/* Compare alternatives (scroll target) */}
      <FutureComparison
        futures={futures}
        chosenFutureId={chosenId}
        selectedId={activeFutureId}
        onSelect={setSelectedFutureId}
      />

      {/* Commit path to workspace memory (timeline cards) */}
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
    <span
      className={`rounded-full px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] ${tone}`}
    >
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
