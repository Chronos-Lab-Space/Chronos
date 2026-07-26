import { useEffect, useMemo, useState } from "react";
import {
  buildPipelineProgress,
  type EngineTaskLike,
} from "../../../../domain/workspace/decisionPipeline";

type Props = {
  tasks: readonly EngineTaskLike[] | null | undefined;
  simulationStatus: string;
  chosenFutureId: string | null;
  /** When true, replay completed phases with min dwell after mount */
  replay?: boolean;
};

/**
 * Real engine lifecycle strip — never invents phases.
 * Replay mode flashes completed phases at min dwell so one-shot runs still feel like a pipeline.
 */
export function DecisionPipelineStrip({
  tasks,
  simulationStatus,
  chosenFutureId,
  replay = false,
}: Props) {
  const base = useMemo(
    () =>
      buildPipelineProgress({
        tasks,
        simulationStatus,
        chosenFutureId,
      }),
    [tasks, simulationStatus, chosenFutureId]
  );

  const [visibleCount, setVisibleCount] = useState(() =>
    replay && simulationStatus === "completed" ? 1 : base.lifecycle.length
  );

  // biome-ignore lint/correctness/useExhaustiveDependencies(tasks): restart the replay animation whenever the task set changes
  useEffect(() => {
    if (!replay || simulationStatus !== "completed") {
      setVisibleCount(base.lifecycle.length);
      return;
    }
    setVisibleCount(1);
    if (base.lifecycle.length <= 1) return;

    let i = 1;
    const id = window.setInterval(() => {
      i += 1;
      setVisibleCount(i);
      if (i >= base.lifecycle.length) {
        window.clearInterval(id);
      }
    }, base.dwellMs);
    return () => window.clearInterval(id);
  }, [replay, simulationStatus, base.lifecycle.length, base.dwellMs, tasks]);

  const showDecide = simulationStatus === "completed" || simulationStatus === "failed";

  return (
    <nav
      aria-label="Decision pipeline"
      data-testid="decision-pipeline"
      className="rounded-2xl border border-line bg-bg-soft/40 px-4 py-4"
    >
      <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-faint">
        Decision pipeline
      </div>
      <ol className="mt-3 space-y-2">
        {base.lifecycle.map((step, index) => {
          const revealed = index < visibleCount;
          const isActive =
            revealed &&
            (index === Math.min(visibleCount, base.lifecycle.length) - 1 ||
              step.status === "running");
          const done =
            revealed &&
            (step.status === "completed" ||
              (simulationStatus === "completed" && index < visibleCount));
          return (
            <li
              key={step.id}
              className={`flex items-center justify-between gap-3 text-sm ${
                revealed ? "opacity-100" : "opacity-30"
              }`}
              aria-current={isActive ? "step" : undefined}
            >
              <span className="text-ink">
                <span className="mr-2 font-mono text-[10px] text-ink-faint">
                  {String(index + 1).padStart(2, "0")}
                </span>
                {step.label}
              </span>
              <span
                className={`font-mono text-[10px] uppercase tracking-[0.14em] ${
                  done
                    ? "text-chronos"
                    : step.status === "running" || isActive
                      ? "text-accent-2"
                      : step.status === "failed"
                        ? "text-red-400"
                        : "text-ink-faint"
                }`}
              >
                {done ? "✓" : step.status === "running" || isActive ? "…" : "·"}
              </span>
            </li>
          );
        })}
        {showDecide ? (
          <li
            className="flex items-center justify-between gap-3 border-t border-line pt-2 text-sm"
            aria-current={!base.decideComplete ? "step" : undefined}
            data-testid="pipeline-decide"
          >
            <span className="text-ink">
              <span className="mr-2 font-mono text-[10px] text-ink-faint">
                {String(base.lifecycle.length + 1).padStart(2, "0")}
              </span>
              You decide — save a path
            </span>
            <span
              className={`font-mono text-[10px] uppercase tracking-[0.14em] ${
                base.decideComplete ? "text-chronos" : "text-accent-2"
              }`}
            >
              {base.decideComplete ? "✓" : "pending"}
            </span>
          </li>
        ) : null}
      </ol>

      {/* Product stages summary */}
      <ul className="mt-4 flex flex-wrap gap-2" data-testid="decision-stages">
        {base.stages.map((s) => (
          <li
            key={s.id}
            className={`rounded-full px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] ${
              s.complete ? "bg-chronos/15 text-chronos" : "bg-bg text-ink-faint ring-1 ring-line"
            }`}
          >
            {s.complete ? "✓ " : ""}
            {s.label}
          </li>
        ))}
      </ul>
    </nav>
  );
}
