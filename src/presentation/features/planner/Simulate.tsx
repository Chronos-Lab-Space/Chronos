import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { PageHeader } from "../../components/PageHeader";
import { formatCurrency, formatPercent } from "../../../domain/chronos/startup-sim";
import type { SimulationResult, Path, Milestone } from "../../../domain/chronos/startup-sim";
import {
  createPublicStartupRequest,
  publicStartupSimulator,
} from "../../../application/planner/publicStartupSimulator";
import { StartupLaunchPlanner } from "../../../application/planner/StartupLaunchPlanner";
import { useAccessModal } from "../access/AccessModal";

const EXAMPLES = [
  "AI meeting assistant that summarizes and assigns action items",
  "Developer tooling for evaluating LLM applications",
  "Consumer wellness app with AI coaching",
  "Vertical SaaS for dental practices",
  "Marketplace connecting indie contractors with startups",
];

const PHASES = [
  { id: "fork", label: "Fork", from: 0, to: 0.2 },
  { id: "plan", label: "Plan", from: 0.2, to: 0.4 },
  { id: "evaluate", label: "Evaluate", from: 0.4, to: 0.65 },
  { id: "prune", label: "Prune", from: 0.65, to: 0.85 },
  { id: "collapse", label: "Collapse", from: 0.85, to: 1 },
] as const;

type Stage = "idle" | "simulating" | "results" | "error";

export function Simulate() {
  const [stage, setStage] = useState<Stage>("idle");
  const [idea, setIdea] = useState("");
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [resultSource, setResultSource] = useState<"cache" | "computed" | null>(null);
  const [progress, setProgress] = useState(0);
  const [branchCounter, setBranchCounter] = useState(0);
  const [branchLog, setBranchLog] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [activeTaskIdx, setActiveTaskIdx] = useState(0);

  const graph = useMemo(
    () =>
      new StartupLaunchPlanner().decompose({
        workspaceId: "public-startup-simulator",
        decisionId: "simulate-page",
        prompt: idea || "startup idea",
      }),
    [idea]
  );

  useEffect(() => {
    if (stage !== "simulating") return;
    const n = graph.tasks.length;
    setActiveTaskIdx(0);
    const timers = graph.tasks.map((_, i) =>
      window.setTimeout(() => setActiveTaskIdx(i), 200 + i * Math.floor(2200 / Math.max(n, 1)))
    );
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [stage, graph.tasks]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!idea.trim()) return;
    startSimulation(idea.trim());
  };

  const startSimulation = (ideaText: string) => {
    setStage("simulating");
    setProgress(0);
    setBranchCounter(0);
    setBranchLog([`objective · ${ideaText.slice(0, 64)}${ideaText.length > 64 ? "…" : ""}`]);
    setResultSource(null);
    setError("");
    setResult(null);

    const simulationPromise = publicStartupSimulator.run(
      createPublicStartupRequest(ideaText)
    );

    const duration = 2800;
    const start = Date.now();

    const tick = () => {
      const elapsed = Date.now() - start;
      const p = Math.min(elapsed / duration, 1);
      // Ease-out so collapse feels deliberate
      const eased = 1 - Math.pow(1 - p, 1.6);
      setProgress(eased);
      setBranchCounter(Math.floor(eased * 1000));

      if (Math.random() < 0.12) {
        const id = `0x${Math.floor(Math.random() * 65536)
          .toString(16)
          .padStart(4, "0")}`;
        const score = (Math.random() * 0.75 + 0.12).toFixed(3);
        let status = "evaluated";
        if (eased < 0.25) status = "forked";
        else if (eased < 0.45) status = "planned";
        else if (eased > 0.65 && Math.random() < 0.55) status = "pruned";
        else if (eased > 0.85) status = "ranked";
        setBranchLog((prev) =>
          [...prev, `branch_${id} · score ${score} · ${status}`].slice(-10)
        );
      }

      if (p < 1) {
        requestAnimationFrame(tick);
      } else {
        void simulationPromise
          .then(({ result: simulationResult, source }) => {
            setResult(simulationResult);
            setResultSource(source);
            setStage("results");
          })
          .catch((err) => {
            setError((err as Error).message || "Simulation failed.");
            setStage("error");
          });
      }
    };
    requestAnimationFrame(tick);
  };

  const reset = () => {
    setStage("idle");
    setIdea("");
    setResult(null);
    setResultSource(null);
    setError("");
    setProgress(0);
    setBranchCounter(0);
    setBranchLog([]);
  };

  return (
    <>
      <PageHeader
        breadcrumb={[{ label: "Simulate" }]}
        eyebrow="/ chronos · startup simulator"
        title={
          <>
            Simulate your
            <br />
            <span className="italic text-ink-dim">startup.</span>
          </>
        }
        subtitle="Enter an idea. Chronos forks ~1,000 possible futures — go-to-market paths, timelines, and outcomes — then collapses to the highest expected ARR with ranked alternatives."
      />

      <section className="relative pb-24 lg:pb-32">
        <div className="mx-auto max-w-7xl px-6 lg:px-10">
          <div className="mb-8">
            <form
              onSubmit={handleSubmit}
              className="glow-border rounded-2xl border border-line bg-bg-soft p-6 lg:p-8"
            >
              <label className="block">
                <div className="mb-3 font-mono text-[11px] uppercase tracking-[0.25em] text-ink-faint">
                  Your idea
                </div>
                <input
                  id="startup-idea"
                  aria-label="Your idea"
                  type="text"
                  value={idea}
                  onChange={(e) => setIdea(e.target.value)}
                  disabled={stage === "simulating"}
                  placeholder="e.g. AI meeting assistant for engineering teams"
                  className="w-full rounded-lg border border-line bg-bg px-4 py-3.5 font-serif text-lg text-ink placeholder:text-ink-faint focus:border-chronos/50 focus:outline-none disabled:opacity-50 sm:px-5 sm:py-4 sm:text-xl"
                />
              </label>

              <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink-faint">
                    Try:
                  </span>
                  {EXAMPLES.slice(0, 4).map((ex, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => {
                        setIdea(ex);
                        startSimulation(ex);
                      }}
                      disabled={stage === "simulating"}
                      className="rounded-full border border-line bg-bg px-3 py-1 font-mono text-[11px] text-ink-dim transition hover:border-line-strong hover:text-ink disabled:opacity-50"
                    >
                      {ex.split(" ").slice(0, 3).join(" ")}…
                    </button>
                  ))}
                </div>

                <button
                  type="submit"
                  disabled={!idea.trim() || stage === "simulating"}
                  className="group inline-flex w-full items-center justify-center gap-2 rounded-full bg-ink px-6 py-3 text-sm font-medium text-bg transition hover:bg-chronos disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
                >
                  {stage === "simulating" ? "Simulating…" : "Simulate 1,000 futures"}
                  {stage !== "simulating" && (
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 14 14"
                      className="transition group-hover:translate-x-0.5"
                    >
                      <path
                        d="M2 7h10M8 3l4 4-4 4"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        fill="none"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </button>
              </div>
            </form>
          </div>

          {stage === "idle" && <IdleHint />}

          {stage === "simulating" && (
            <SimulatingPanel
              progress={progress}
              counter={branchCounter}
              log={branchLog}
              tasks={graph.tasks.map((t) => t.title)}
              activeTaskIdx={activeTaskIdx}
            />
          )}

          {stage === "error" && (
            <div className="rounded-2xl border border-line bg-bg-soft p-8 text-center">
              <p className="text-sm text-ink-dim">{error || "Something went wrong."}</p>
              <button
                type="button"
                onClick={reset}
                className="mt-4 rounded-full border border-line px-4 py-2 text-sm text-ink-dim hover:text-ink"
              >
                Try again
              </button>
            </div>
          )}

          {stage === "results" && result && (
            <ResultsPanel result={result} source={resultSource} onReset={reset} />
          )}
        </div>
      </section>
    </>
  );
}

function IdleHint() {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
      {[
        {
          n: "01",
          t: "Fork futures",
          d: "Chronos branches your idea into many go-to-market and product timelines.",
        },
        {
          n: "02",
          t: "Evaluate trade-offs",
          d: "Each path is scored on ARR, probability, CAC/LTV, and time to PMF.",
        },
        {
          n: "03",
          t: "Collapse to best",
          d: "Weak paths prune. The strongest recommendation and close alternatives remain.",
        },
      ].map((card) => (
        <div key={card.n} className="rounded-xl border border-line bg-bg-soft/60 p-5">
          <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-chronos">
            {card.n}
          </div>
          <div className="mt-2 font-serif text-xl text-ink">{card.t}</div>
          <p className="mt-2 text-[13px] leading-[1.6] text-ink-dim">{card.d}</p>
        </div>
      ))}
    </div>
  );
}

function SimulatingPanel({
  progress,
  counter,
  log,
  tasks,
  activeTaskIdx,
}: {
  progress: number;
  counter: number;
  log: string[];
  tasks: string[];
  activeTaskIdx: number;
}) {
  const phaseLabel =
    PHASES.find((p) => progress >= p.from && progress < p.to)?.label ??
    (progress >= 1 ? "Collapse" : "Fork");

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
      <div className="rounded-2xl border border-line bg-bg-soft p-6 lg:col-span-7 lg:p-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="relative flex h-3 w-3">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-chronos opacity-60" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-chronos" />
            </span>
            <span className="font-mono text-[12px] uppercase tracking-[0.2em] text-chronos">
              {phaseLabel} · {counter.toLocaleString()} / 1,000 futures
            </span>
          </div>
          <span className="font-mono text-[11px] tabular-nums text-ink-faint">
            {Math.round(progress * 100)}%
          </span>
        </div>

        <div className="relative mb-6 h-1.5 w-full overflow-hidden rounded-full bg-line">
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-chronos to-accent-warm transition-[width] duration-75"
            style={{ width: `${progress * 100}%` }}
          />
        </div>

        <div className="-mx-1 mb-6 overflow-x-auto px-1 pb-1">
          <div className="grid min-w-[28rem] grid-cols-5 gap-1.5 sm:min-w-0">
            {PHASES.map((phase) => {
              const active = progress >= phase.from && progress < phase.to;
              const done = progress >= phase.to;
              return (
                <div
                  key={phase.id}
                  className={`rounded-md border px-2 py-2 text-center font-mono text-[10px] uppercase tracking-[0.14em] transition ${
                    active
                      ? "border-chronos/50 bg-chronos/10 text-chronos"
                      : done
                        ? "border-chronos/30 text-chronos/80"
                        : "border-line text-ink-faint"
                  }`}
                >
                  {done && !active ? "✓ " : ""}
                  {phase.label}
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-lg border border-line bg-bg p-4">
          <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.25em] text-ink-faint">
            execution log
          </div>
          <div className="min-h-[140px] space-y-1 font-mono text-[11px]">
            {log.length === 0 && (
              <div className="text-ink-faint">Waiting for first branch…</div>
            )}
            {log.map((entry, i) => (
              <div key={`${entry}-${i}`} className="flex items-start gap-2 text-ink-dim">
                <span
                  className={
                    entry.includes("pruned")
                      ? "text-ink-faint"
                      : entry.includes("ranked") || entry.includes("evaluated")
                        ? "text-accent-2"
                        : "text-chronos"
                  }
                >
                  →
                </span>
                <span>{entry}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-line bg-bg-soft p-6 lg:col-span-5 lg:p-8">
        <div className="mb-4 font-mono text-[10px] uppercase tracking-[0.23em] text-ink-faint">
          Capability pipeline
        </div>
        <div className="space-y-2">
          {tasks.map((title, i) => {
            const active = i === activeTaskIdx;
            const done = i < activeTaskIdx;
            return (
              <div
                key={title}
                className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 transition ${
                  active
                    ? "border-chronos/45 bg-chronos/10"
                    : done
                      ? "border-line bg-bg/60"
                      : "border-line bg-bg/30 opacity-60"
                }`}
              >
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border font-mono text-[9px] ${
                    active
                      ? "border-chronos text-chronos"
                      : done
                        ? "border-chronos/40 text-chronos"
                        : "border-line text-ink-faint"
                  }`}
                >
                  {done ? "✓" : String(i + 1).padStart(2, "0")}
                </span>
                <span className="text-[13px] text-ink">{title}</span>
              </div>
            );
          })}
        </div>
        <p className="mt-5 text-[12px] leading-[1.6] text-ink-faint">
          Tasks resolve capabilities in dependency order while futures are forked
          and scored in parallel.
        </p>
      </div>
    </div>
  );
}

function ResultsPanel({
  result,
  source,
  onReset,
}: {
  result: SimulationResult;
  source: "cache" | "computed" | null;
  onReset: () => void;
}) {
  const { openAccessModal } = useAccessModal();
  const ranked = useMemo(() => {
    const all = [result.bestPath, ...result.alternatives];
    const maxArr = Math.max(...all.map((p) => p.arr), 1);
    return all.map((p, i) => ({
      path: p,
      rank: i + 1,
      isBest: i === 0,
      arrPct: p.arr / maxArr,
    }));
  }, [result]);

  return (
    <div className="space-y-6">
      {/* Recommendation banner */}
      <div className="rounded-2xl border border-chronos/35 bg-chronos/10 p-5 sm:p-6">
        <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-chronos">
          Recommendation
        </div>
        <p className="mt-2 max-w-3xl text-[15px] leading-[1.7] text-ink">
          <span className="font-medium text-ink">{result.bestPath.name}</span>
          {" — "}
          {result.bestPath.thesis} Chronos ranked this highest across{" "}
          {result.totalPaths.toLocaleString()} simulated futures
          {result.pathsEvaluated ? ` (${result.pathsEvaluated.toLocaleString()} evaluated)` : ""}.
        </p>
      </div>

      {/* Header card */}
      <div className="rounded-2xl border border-line bg-bg-soft p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="font-mono text-[11px] uppercase tracking-[0.25em] text-chronos">
                / best path · branch_{result.bestBranchId}
              </span>
              <span className="rounded-full border border-chronos/40 bg-chronos/10 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.2em] text-chronos">
                {result.categoryLabel}
              </span>
              {source === "cache" && (
                <span className="rounded-full border border-accent-2/40 bg-accent-2/10 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.2em] text-accent-2">
                  Cache hit
                </span>
              )}
              {source === "computed" && (
                <span className="rounded-full border border-line px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-faint">
                  Fresh run
                </span>
              )}
            </div>
            <h2 className="font-serif text-4xl leading-tight md:text-5xl">
              {result.bestPath.name}
              <span className="ml-1 text-ink-faint">.</span>
            </h2>
            <p className="mt-4 max-w-2xl text-[15px] leading-[1.7] text-ink-dim">
              {result.bestPath.thesis}
            </p>
          </div>

          <div className="text-right">
            <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink-faint">
              Expected ARR
            </div>
            <div className="font-serif text-5xl text-accent-warm tabular-nums">
              {formatCurrency(result.bestPath.arr)}
            </div>
            <div className="mt-2 font-mono text-[11px] text-ink-dim">
              <span className="text-accent-2">
                {formatPercent(result.bestPath.probability)}
              </span>
              <span className="text-ink-faint"> · probability of success</span>
            </div>
          </div>
        </div>

        <div className="mt-8 grid grid-cols-2 gap-4 border-t border-line pt-6 md:grid-cols-5">
          <MetricStat label="ARR" value={formatCurrency(result.bestPath.arr)} />
          <MetricStat label="Probability" value={formatPercent(result.bestPath.probability)} />
          <MetricStat label="Months to PMF" value={`${result.bestPath.monthsToPmf}`} />
          <MetricStat label="CAC" value={formatCurrency(result.bestPath.cac)} />
          <MetricStat label="LTV" value={formatCurrency(result.bestPath.ltv)} />
        </div>
      </div>

      {/* Ranked futures comparison */}
      <div className="rounded-2xl border border-line bg-bg-soft p-6 sm:p-8">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink-faint">
              Ranked futures
            </div>
            <div className="mt-1 font-serif text-2xl text-ink">
              Compare the top paths<span className="text-ink-faint">.</span>
            </div>
          </div>
          <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-faint">
            by expected ARR
          </div>
        </div>
        <div className="space-y-3">
          {ranked.map(({ path, rank, isBest, arrPct }) => (
            <div
              key={path.id}
              className={`rounded-xl border p-4 transition ${
                isBest
                  ? "border-chronos/40 bg-chronos/10"
                  : "border-line bg-bg/50"
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] text-ink-faint">#{rank}</span>
                    <span className="font-serif text-xl text-ink">{path.name}</span>
                    {isBest && (
                      <span className="rounded-full border border-chronos/40 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em] text-chronos">
                        best
                      </span>
                    )}
                  </div>
                  <p className="mt-1 max-w-2xl text-[13px] text-ink-dim line-clamp-2">
                    {path.thesis}
                  </p>
                </div>
                <div className="text-right">
                  <div className="font-serif text-2xl text-ink tabular-nums">
                    {formatCurrency(path.arr)}
                  </div>
                  <div className="font-mono text-[10px] text-ink-faint">
                    {formatPercent(path.probability)} · {path.monthsToPmf} mo PMF
                  </div>
                </div>
              </div>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-line">
                <div
                  className={`h-full rounded-full ${isBest ? "bg-chronos" : "bg-ink-faint/40"}`}
                  style={{ width: `${Math.round(arrPct * 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Timeline */}
      <div className="rounded-2xl border border-line bg-bg-soft p-6 sm:p-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink-faint">
              18-month roadmap
            </div>
            <div className="mt-1 font-serif text-2xl text-ink">
              Month by month<span className="text-ink-faint">.</span>
            </div>
          </div>
          <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink-faint">
            {result.bestPath.milestones.length} milestones
          </div>
        </div>
        <Timeline milestones={result.bestPath.milestones} />
      </div>

      {/* Highlights + Risks */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-chronos/30 bg-chronos/10 p-6">
          <div className="mb-4 flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-chronos" />
            <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-chronos">
              Why this path wins
            </div>
          </div>
          <ul className="space-y-2">
            {result.bestPath.highlights.map((h, i) => (
              <li key={i} className="flex items-start gap-2 text-[13px] leading-[1.5] text-ink-dim">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-chronos" />
                <span>{h}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-2xl border border-line bg-bg p-6">
          <div className="mb-4 flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-ink-faint" />
            <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink-faint">
              Risks & trade-offs
            </div>
          </div>
          <ul className="space-y-2">
            {result.bestPath.risks.map((r, i) => (
              <li key={i} className="flex items-start gap-2 text-[13px] leading-[1.5] text-ink-dim">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-ink-faint" />
                <span>{r}</span>
              </li>
            ))}
          </ul>
          <div className="mt-4 border-t border-line pt-4 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint">
            Burn ~{formatCurrency(result.bestPath.burn)}/mo · LTV/CAC{" "}
            {result.bestPath.cac > 0
              ? (result.bestPath.ltv / result.bestPath.cac).toFixed(1)
              : "—"}
            x
          </div>
        </div>
      </div>

      {/* Alternatives detail */}
      <div className="rounded-2xl border border-line bg-bg-soft p-6 sm:p-8">
        <div className="mb-6">
          <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink-faint">
            {result.totalPaths} paths evaluated · {result.alternatives.length} alternatives
          </div>
          <div className="mt-1 font-serif text-2xl text-ink">
            Other futures that almost won<span className="text-ink-faint">.</span>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {result.alternatives.map((alt) => (
            <AlternativeCard key={alt.id} path={alt} />
          ))}
        </div>
      </div>

      {/* CTAs */}
      <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
        <button
          type="button"
          onClick={onReset}
          className="group inline-flex items-center gap-2 rounded-full border border-line px-6 py-3 text-sm font-medium text-ink-dim transition hover:border-line-strong hover:text-ink"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            className="transition group-hover:-rotate-180"
            style={{ transitionDuration: "500ms" }}
          >
            <path
              d="M2 7a5 5 0 1 0 5-5M2 2v5h5"
              stroke="currentColor"
              strokeWidth="1.5"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Simulate another idea
        </button>
        <button
          type="button"
          onClick={openAccessModal}
          className="inline-flex items-center gap-2 rounded-full bg-ink px-6 py-3 text-sm font-medium text-bg transition hover:bg-chronos"
        >
          Continue in workspace
        </button>
        <Link
          to="/docs?section=simulations"
          className="inline-flex items-center gap-2 rounded-full border border-line px-6 py-3 text-sm font-medium text-ink-dim transition hover:border-line-strong hover:text-ink"
        >
          How simulations work
        </Link>
      </div>
    </div>
  );
}

function Timeline({ milestones }: { milestones: Milestone[] }) {
  return (
    <div className="relative">
      <div className="absolute left-6 top-6 bottom-6 w-px bg-line md:left-8" />
      <div className="space-y-6">
        {milestones.map((m, i) => (
          <div key={i} className="relative flex gap-6 pl-0">
            <div className="relative z-10 flex h-12 w-12 shrink-0 items-center justify-center md:h-16 md:w-16">
              <div className="absolute inset-0 rounded-full border border-chronos/40 bg-bg" />
              <div className="absolute inset-1 rounded-full bg-chronos/10" />
              <div className="font-mono text-[11px] text-chronos">M{m.month}</div>
            </div>
            <div className="flex-1 pb-2 pt-1">
              <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink-faint">
                Month {m.month}
              </div>
              <div className="mt-1 font-serif text-xl text-ink">{m.title}</div>
              <div className="mt-1 text-[13px] leading-[1.6] text-ink-dim">{m.description}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MetricStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink-faint">
        {label}
      </div>
      <div className="mt-1 font-serif text-2xl text-ink tabular-nums">{value}</div>
    </div>
  );
}

function AlternativeCard({ path }: { path: Path }) {
  return (
    <div className="rounded-xl border border-line bg-bg p-5 transition hover:border-line-strong">
      <div className="font-serif text-xl text-ink">{path.name}</div>
      <p className="mt-2 text-[12px] leading-[1.6] text-ink-dim line-clamp-3">{path.thesis}</p>
      <div className="mt-4 grid grid-cols-2 gap-3 border-t border-line pt-3">
        <div>
          <div className="font-mono text-[9px] uppercase tracking-[0.16em] text-ink-faint">ARR</div>
          <div className="mt-0.5 font-serif text-lg text-ink">{formatCurrency(path.arr)}</div>
        </div>
        <div>
          <div className="font-mono text-[9px] uppercase tracking-[0.16em] text-ink-faint">
            Probability
          </div>
          <div className="mt-0.5 font-serif text-lg text-ink">{formatPercent(path.probability)}</div>
        </div>
      </div>
      <div className="mt-3 font-mono text-[10px] text-ink-faint">
        {path.monthsToPmf} mo to PMF · first: {path.milestones[0]?.title ?? "—"}
      </div>
    </div>
  );
}
