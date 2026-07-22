import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { StartupLaunchPlanner } from "../../../application/planner/StartupLaunchPlanner";
import {
  createPublicStartupRequest,
  publicStartupSimulator,
} from "../../../application/planner/publicStartupSimulator";
import { formatCurrency, formatPercent } from "../../../domain/chronos/startup-sim";
import type { SimulationResult } from "../../../domain/chronos/startup-sim";

const defaultPrompt = "I want to build an AI meeting assistant.";

const EXAMPLE_PROMPTS = [
  "AI meeting assistant that summarizes and assigns action items",
  "Developer tooling for evaluating LLM applications",
  "Vertical SaaS for dental practices",
];

const PIPELINE = [
  { id: "plan", label: "Plan" },
  { id: "generate", label: "Generate" },
  { id: "evaluate", label: "Evaluate" },
  { id: "rank", label: "Rank" },
  { id: "recommend", label: "Recommend" },
] as const;

type DemoStatus = "idle" | "planning" | "complete" | "error";

/**
 * Compact public experience: type an objective, watch Chronos plan tasks,
 * simulate futures, and surface the best path — without leaving home.
 */
export function HomeLiveDemo() {
  const [prompt, setPrompt] = useState(defaultPrompt);
  const [status, setStatus] = useState<DemoStatus>("idle");
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [source, setSource] = useState<"cache" | "computed" | null>(null);
  const [error, setError] = useState("");
  const [activeTask, setActiveTask] = useState(-1);
  const [pipelineStep, setPipelineStep] = useState(0);
  const [futuresSeen, setFuturesSeen] = useState(0);

  const graph = useMemo(
    () =>
      new StartupLaunchPlanner().decompose({
        workspaceId: "public-startup-simulator",
        decisionId: "public-launch-decision",
        prompt,
      }),
    [prompt]
  );

  // Animate task focus + pipeline while planning
  useEffect(() => {
    if (status !== "planning") return;

    setActiveTask(0);
    setPipelineStep(0);
    setFuturesSeen(0);

    const taskTimers: number[] = [];
    const taskCount = graph.tasks.length;
    for (let i = 0; i < taskCount; i++) {
      taskTimers.push(
        window.setTimeout(() => {
          setActiveTask(i);
          setPipelineStep(Math.min(3, Math.floor((i / Math.max(taskCount - 1, 1)) * 3)));
          setFuturesSeen(Math.floor(((i + 1) / taskCount) * 820) + 40);
        }, 180 + i * 220)
      );
    }

    const rankTimer = window.setTimeout(() => {
      setPipelineStep(3);
      setFuturesSeen(1000);
    }, 180 + taskCount * 220 + 200);

    return () => {
      taskTimers.forEach((t) => window.clearTimeout(t));
      window.clearTimeout(rankTimer);
    };
  }, [status, graph.tasks.length]);

  const run = async (event?: React.FormEvent, overridePrompt?: string) => {
    event?.preventDefault();
    const value = (overridePrompt ?? prompt).trim();
    if (!value) return;
    if (overridePrompt) setPrompt(overridePrompt);

    setStatus("planning");
    setResult(null);
    setError("");
    setSource(null);

    const started = Date.now();
    try {
      const response = await publicStartupSimulator.run(createPublicStartupRequest(value));
      // Keep the planning choreography readable even on cache hits
      const elapsed = Date.now() - started;
      const minShow = 1600;
      if (elapsed < minShow) {
        await new Promise((resolve) => window.setTimeout(resolve, minShow - elapsed));
      }
      setPipelineStep(4);
      setActiveTask(graph.tasks.length);
      setResult(response.result);
      setSource(response.source);
      setStatus("complete");
    } catch (cause) {
      setError((cause as Error).message || "Unable to run the simulation.");
      setStatus("error");
    }
  };

  return (
    <section className="relative border-y border-line py-24 lg:py-32">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-0 h-px w-2/3 -translate-x-1/2 bg-gradient-to-r from-transparent via-chronos/30 to-transparent" />
      </div>

      <div className="relative mx-auto max-w-7xl px-6 lg:px-10">
        <div className="mb-10 flex flex-wrap items-end justify-between gap-6">
          <div>
            <div className="mb-4 flex items-center gap-3">
              <span className="font-mono text-[11px] uppercase tracking-[0.25em] text-chronos">
                / live demo
              </span>
              <div className="h-px w-10 bg-line" />
              <span className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-faint">
                <span className="h-1.5 w-1.5 rounded-full bg-chronos blink" />
                Public sandbox
              </span>
            </div>
            <h2 className="font-serif text-4xl leading-[1] tracking-tight md:text-5xl">
              Give Chronos a goal.
              <br />
              <span className="italic text-ink-dim">Watch it plan the future.</span>
            </h2>
          </div>
          <p className="max-w-sm text-[14px] leading-[1.7] text-ink-dim">
            Not a single chatbot answer. Chronos builds a task graph, simulates
            timelines, ranks trade-offs, and recommends the strongest path.
          </p>
        </div>

        {/* Pipeline rail — scrollable on narrow phones so labels stay readable */}
        <div className="mb-6 -mx-1 overflow-x-auto px-1 pb-1">
          <div className="grid min-w-[32rem] grid-cols-5 gap-1.5 sm:min-w-0">
            {PIPELINE.map((step, i) => {
              const active = status === "planning" && pipelineStep === i;
              const done =
                status === "complete" ||
                (status === "planning" && pipelineStep > i) ||
                (status === "complete" && true);
              return (
                <div
                  key={step.id}
                  className={`rounded-md border px-2 py-2 text-center transition ${
                    active
                      ? "border-chronos/50 bg-chronos/10 text-chronos"
                      : done && status !== "idle"
                        ? "border-chronos/25 bg-chronos/5 text-chronos/80"
                        : "border-line text-ink-faint"
                  }`}
                >
                  <div className="font-mono text-[9px] uppercase tracking-[0.16em]">
                    {String(i + 1).padStart(2, "0")}
                  </div>
                  <div className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.12em]">
                    {step.label}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-line bg-bg-soft shadow-[0_0_0_1px_rgba(198,240,255,0.03)_inset]">
          <form onSubmit={(e) => void run(e)} className="border-b border-line p-5 sm:p-6">
            <label className="block">
              <span className="font-mono text-[10px] uppercase tracking-[0.23em] text-ink-faint">
                Objective
              </span>
              <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                <input
                  value={prompt}
                  onChange={(event) => setPrompt(event.target.value)}
                  aria-label="Simulation objective"
                  disabled={status === "planning"}
                  placeholder="What should Chronos decide?"
                  className="min-w-0 w-full flex-1 rounded-lg border border-line bg-bg px-4 py-3 font-serif text-base text-ink placeholder:text-ink-faint focus:border-chronos/60 focus:outline-none disabled:opacity-60 sm:text-lg"
                />
                <button
                  type="submit"
                  disabled={status === "planning" || !prompt.trim()}
                  className="inline-flex w-full shrink-0 items-center justify-center gap-2 rounded-lg bg-ink px-5 py-3 text-sm font-medium text-bg transition hover:bg-chronos disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                >
                  {status === "planning" ? "Simulating…" : "Run simulation"}
                  {status !== "planning" && (
                    <svg width="14" height="14" viewBox="0 0 14 14">
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
            </label>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-ink-faint">
                Try
              </span>
              {EXAMPLE_PROMPTS.map((ex) => (
                <button
                  key={ex}
                  type="button"
                  disabled={status === "planning"}
                  onClick={() => void run(undefined, ex)}
                  className="rounded-full border border-line bg-bg px-3 py-1 font-mono text-[10px] text-ink-dim transition hover:border-line-strong hover:text-ink disabled:opacity-50"
                >
                  {ex.split(" ").slice(0, 4).join(" ")}…
                </button>
              ))}
            </div>
          </form>

          <div className="grid grid-cols-1 lg:grid-cols-12">
            {/* Task graph */}
            <div className="border-b border-line p-5 lg:col-span-7 lg:border-b-0 lg:border-r lg:p-6">
              <div className="mb-5 flex items-center justify-between gap-3">
                <div className="font-mono text-[10px] uppercase tracking-[0.23em] text-ink-faint">
                  Planner task graph
                </div>
                <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-chronos">
                  {status === "planning"
                    ? `${Math.min(activeTask + 1, graph.tasks.length)}/${graph.tasks.length} running`
                    : `${graph.tasks.length} tasks`}
                </div>
              </div>

              <div className="space-y-0">
                {graph.tasks.map((task, index) => {
                  const isActive = status === "planning" && activeTask === index;
                  const isDone =
                    status === "complete" ||
                    (status === "planning" && activeTask > index);
                  return (
                    <div key={task.id}>
                      <div className="flex items-center gap-4">
                        <span
                          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border bg-bg font-mono text-[10px] transition ${
                            isActive
                              ? "border-chronos text-chronos shadow-[0_0_12px_rgba(96,137,155,0.35)]"
                              : isDone
                                ? "border-chronos/40 bg-chronos/10 text-chronos"
                                : "border-line text-ink-faint"
                          }`}
                        >
                          {isDone && !isActive ? "✓" : String(index + 1).padStart(2, "0")}
                        </span>
                        <div
                          className={`min-w-0 flex-1 rounded-lg border px-4 py-3 transition ${
                            isActive
                              ? "border-chronos/45 bg-chronos/10"
                              : isDone
                                ? "border-line bg-bg/80"
                                : "border-line bg-bg/70"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <span className="font-serif text-xl text-ink">{task.title}</span>
                            <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-ink-faint">
                              {isActive ? "running" : task.kind}
                            </span>
                          </div>
                          {task.dependencies.length > 0 && (
                            <div className="mt-1 font-mono text-[9px] uppercase tracking-[0.16em] text-ink-faint">
                              waits for: {task.dependencies.join(" · ")}
                            </div>
                          )}
                        </div>
                      </div>
                      {index < graph.tasks.length - 1 && (
                        <div
                          className={`ml-4 h-3 border-l border-dashed transition ${
                            isDone ? "border-chronos/40" : "border-line-strong"
                          }`}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Ranked timeline / result */}
            <div className="p-5 lg:col-span-5 lg:p-6">
              <div className="mb-5 flex items-center justify-between gap-2">
                <div className="font-mono text-[10px] uppercase tracking-[0.23em] text-ink-faint">
                  Ranked timeline
                </div>
                <div className="flex items-center gap-2">
                  {status === "planning" && (
                    <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-chronos">
                      {futuresSeen.toLocaleString()} futures
                    </span>
                  )}
                  {source === "cache" && (
                    <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-accent-2">
                      Cache hit
                    </span>
                  )}
                </div>
              </div>

              {status === "idle" && <DemoEmpty onTry={() => void run()} />}
              {status === "planning" && <DemoPlanning futures={futuresSeen} step={pipelineStep} />}
              {status === "error" && (
                <p className="rounded-lg border border-line bg-bg p-4 font-mono text-[11px] text-ink-dim">
                  {error}
                </p>
              )}
              {status === "complete" && result && <DemoResult result={result} />}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-4 sm:px-6">
            <p className="text-[12px] text-ink-faint">
              Full simulator includes 18-month roadmap, alternatives, and risk detail.
            </p>
            <Link
              to="/simulate"
              className="font-mono text-[11px] uppercase tracking-[0.16em] text-chronos transition hover:text-ink"
            >
              Open full simulator →
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function DemoEmpty({ onTry }: { onTry: () => void }) {
  return (
    <div className="flex min-h-72 flex-col items-center justify-center text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full border border-line bg-bg font-serif text-2xl text-chronos">
        ∴
      </div>
      <p className="mt-4 max-w-xs text-[13px] leading-[1.65] text-ink-dim">
        Chronos will generate futures, score trade-offs, and surface the best path
        after the plan runs.
      </p>
      <button
        type="button"
        onClick={onTry}
        className="mt-5 rounded-full border border-line px-4 py-2 font-mono text-[11px] uppercase tracking-[0.16em] text-ink-dim transition hover:border-chronos/40 hover:text-chronos"
      >
        Run sample goal
      </button>
    </div>
  );
}

function DemoPlanning({ futures, step }: { futures: number; step: number }) {
  const labels = ["Building task graph…", "Forking futures…", "Scoring outcomes…", "Ranking paths…", "Selecting best path…"];
  return (
    <div className="flex min-h-72 flex-col justify-center">
      <div className="flex items-center gap-3">
        <div className="h-6 w-6 rounded-full border-2 border-chronos border-t-transparent animate-spin" />
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.23em] text-chronos">
            {labels[Math.min(step, labels.length - 1)]}
          </div>
          <div className="mt-1 text-[12px] text-ink-faint">
            Exploring futures · ranking paths…
          </div>
        </div>
      </div>
      <div className="mt-6 h-1 overflow-hidden rounded-full bg-line">
        <div
          className="h-full rounded-full bg-chronos transition-[width] duration-300"
          style={{ width: `${Math.min(100, (futures / 1000) * 100)}%` }}
        />
      </div>
      <div className="mt-6 space-y-2">
        {["branch_0x4a · score 0.91 · kept", "branch_0x2c · score 0.44 · pruned", "branch_0x7f · score 0.78 · evaluating"].map(
          (line, i) => (
            <div
              key={line}
              className="font-mono text-[10px] text-ink-faint"
              style={{ opacity: 0.35 + (i === step % 3 ? 0.55 : 0.15) }}
            >
              → {line}
            </div>
          )
        )}
      </div>
    </div>
  );
}

function DemoResult({ result }: { result: SimulationResult }) {
  const alts = result.alternatives.slice(0, 2);
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-accent-warm/35 bg-accent-warm/5 p-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-accent-warm">
            Best path · {result.bestBranchId}
          </span>
          <span className="rounded-full border border-line px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em] text-ink-faint">
            {result.categoryLabel}
          </span>
        </div>
        <div className="mt-3 font-serif text-3xl text-ink">{result.bestPath.name}</div>
        <p className="mt-3 text-[13px] leading-[1.65] text-ink-dim">{result.bestPath.thesis}</p>

        <div className="mt-5 grid grid-cols-2 gap-3 border-t border-accent-warm/20 pt-4 sm:grid-cols-3">
          <MiniStat label="Expected ARR" value={formatCurrency(result.bestPath.arr)} accent />
          <MiniStat label="Probability" value={formatPercent(result.bestPath.probability)} accent />
          <MiniStat label="Months to PMF" value={`${result.bestPath.monthsToPmf}`} />
        </div>

        <div className="mt-5 border-t border-accent-warm/20 pt-4">
          <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-ink-faint">
            First move
          </div>
          <div className="mt-1 text-[13px] text-ink">
            Month {result.bestPath.milestones[0]?.month}: {result.bestPath.milestones[0]?.title}
          </div>
        </div>
      </div>

      {alts.length > 0 && (
        <div>
          <div className="mb-2 font-mono text-[9px] uppercase tracking-[0.18em] text-ink-faint">
            Close alternatives
          </div>
          <div className="space-y-2">
            {alts.map((alt) => (
              <div
                key={alt.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-line bg-bg/60 px-3 py-2.5"
              >
                <div className="min-w-0">
                  <div className="truncate text-[13px] text-ink">{alt.name}</div>
                  <div className="font-mono text-[9px] text-ink-faint">
                    {formatPercent(alt.probability)} · {formatCurrency(alt.arr)}
                  </div>
                </div>
                <div className="h-1.5 w-16 overflow-hidden rounded-full bg-line">
                  <div
                    className="h-full rounded-full bg-ink-faint/50"
                    style={{ width: `${Math.round(alt.probability * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {result.bestPath.risks[0] && (
        <div className="rounded-lg border border-line bg-bg/50 px-3 py-2.5">
          <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-ink-faint">
            Top risk
          </div>
          <div className="mt-1 text-[12px] leading-[1.5] text-ink-dim">{result.bestPath.risks[0]}</div>
        </div>
      )}
    </div>
  );
}

function MiniStat({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div>
      <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-ink-faint">{label}</div>
      <div className={`mt-1 font-serif text-2xl ${accent ? "text-accent-warm" : "text-ink"}`}>
        {value}
      </div>
    </div>
  );
}
