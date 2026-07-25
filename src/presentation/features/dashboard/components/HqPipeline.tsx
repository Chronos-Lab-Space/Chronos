import type { SimulationRecord } from "../../../../domain/workspace/types";

const STAGES = [
  { id: "draft", label: "Draft", detail: "Define objective" },
  { id: "simulating", label: "Simulating", detail: "Explore futures" },
  { id: "evaluating", label: "Evaluating", detail: "Score & rank" },
  { id: "collapsed", label: "Collapsed", detail: "Select best path" },
  { id: "observed", label: "Observed", detail: "Track outcome" },
  { id: "learned", label: "Learned", detail: "Improve engine" },
] as const;

function activeIndex(sim: SimulationRecord | null | undefined): number {
  if (!sim) return 0;
  if (sim.status === "running" || sim.status === "queued") return 1;
  if (sim.status === "failed") return 2;
  if (sim.status === "completed" && !sim.result.chosen_future_id) return 3;
  if (sim.result.chosen_future_id && !sim.result.outcome_followed) return 4;
  if (sim.result.outcome_followed || sim.result.outcome_result) return 5;
  if (sim.status === "completed") return 3;
  return 0;
}

/** Horizontal HQ lifecycle strip matching product mock. */
export function HqPipeline({ latest }: { latest: SimulationRecord | null }) {
  const active = activeIndex(latest);

  return (
    <nav
      aria-label="Decision lifecycle"
      data-testid="hq-pipeline"
      className="overflow-x-auto rounded-2xl border border-line bg-bg-soft/20 px-3 py-4 sm:px-5"
    >
      <ol className="flex min-w-[640px] items-start justify-between gap-1">
        {STAGES.map((stage, index) => {
          const done = index < active;
          const current = index === active;
          return (
            <li key={stage.id} className="relative flex flex-1 flex-col items-center text-center">
              {index < STAGES.length - 1 ? (
                <span
                  aria-hidden
                  className={`absolute left-[calc(50%+14px)] right-[calc(-50%+14px)] top-[13px] h-px ${
                    done || current ? "bg-chronos/50" : "bg-line"
                  }`}
                />
              ) : null}
              <span
                className={`relative z-[1] flex h-7 w-7 items-center justify-center rounded-full border text-[10px] ${
                  current
                    ? "border-chronos bg-chronos/20 text-chronos shadow-[0_0_16px_rgba(96,137,155,0.35)]"
                    : done
                      ? "border-chronos/40 bg-chronos/10 text-chronos"
                      : "border-line bg-bg text-ink-faint"
                }`}
              >
                {done ? "✓" : index + 1}
              </span>
              <div
                className={`mt-2 font-mono text-[10px] uppercase tracking-[0.12em] ${
                  current ? "text-chronos" : done ? "text-ink-dim" : "text-ink-faint"
                }`}
              >
                {stage.label}
              </div>
              <div className="mt-0.5 hidden text-[11px] text-ink-faint sm:block">
                {stage.detail}
              </div>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
