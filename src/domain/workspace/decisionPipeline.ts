/**
 * Decision pipeline progress — maps real SimulationEngine task phases
 * to user-visible lifecycle events. Never invents phases the engine did not run.
 *
 * UI may replay completed phases with min dwell (200–400 ms) for legibility
 * when the engine finishes in one shot.
 */

export const DEFAULT_PHASE_DWELL_MS = 300;
export const MIN_PHASE_DWELL_MS = 200;
export const MAX_PHASE_DWELL_MS = 400;

export type EngineTaskPhase = "plan" | "generate" | "evaluate" | "rank" | "collapse";
export type EngineTaskStatus = "pending" | "running" | "completed" | "failed";

export type EngineTaskLike = {
  id?: string;
  title?: string;
  status: EngineTaskStatus | string;
  phase?: EngineTaskPhase | string;
};

/** Product-facing lifecycle step (compute). */
export type LifecycleEvent = {
  id: EngineTaskPhase;
  label: string;
  status: EngineTaskStatus;
};

/** High-level product stages (includes Decide after report). */
export type DecisionStageId = "understand" | "explore" | "evaluate" | "recommend" | "decide";

export type DecisionStageProgress = {
  id: DecisionStageId;
  label: string;
  complete: boolean;
};

export type PipelineProgress = {
  lifecycle: LifecycleEvent[];
  stages: DecisionStageProgress[];
  /** Index into lifecycle for aria-current / strip highlight */
  activeLifecycleIndex: number;
  decideComplete: boolean;
  dwellMs: number;
};

const PHASE_ORDER: EngineTaskPhase[] = ["plan", "generate", "evaluate", "rank", "collapse"];

const PHASE_LABELS: Record<EngineTaskPhase, string> = {
  plan: "Understanding goal",
  generate: "Generating candidate futures",
  evaluate: "Evaluating trade-offs",
  rank: "Ranking outcomes",
  collapse: "Preparing decision report",
};

const STAGE_LABELS: Record<DecisionStageId, string> = {
  understand: "Understand",
  explore: "Explore",
  evaluate: "Evaluate",
  recommend: "Recommend",
  decide: "Decide",
};

export function clampPhaseDwellMs(ms: number | undefined): number {
  if (ms == null || !Number.isFinite(ms)) return DEFAULT_PHASE_DWELL_MS;
  return Math.min(MAX_PHASE_DWELL_MS, Math.max(MIN_PHASE_DWELL_MS, Math.round(ms)));
}

function asPhase(raw: unknown): EngineTaskPhase | null {
  if (
    raw === "plan" ||
    raw === "generate" ||
    raw === "evaluate" ||
    raw === "rank" ||
    raw === "collapse"
  ) {
    return raw;
  }
  return null;
}

function asStatus(raw: unknown): EngineTaskStatus {
  if (raw === "pending" || raw === "running" || raw === "completed" || raw === "failed") {
    return raw;
  }
  return "pending";
}

/**
 * Map engine tasks to ordered lifecycle events.
 * Uses known phase order; only includes phases present in the task list (or defaults shell).
 */
export function mapEngineTasksToLifecycle(
  tasks: readonly EngineTaskLike[] | null | undefined
): LifecycleEvent[] {
  const list = Array.isArray(tasks) ? tasks : [];
  const byPhase = new Map<EngineTaskPhase, EngineTaskLike>();

  for (const t of list) {
    const phase = asPhase(t.phase) ?? asPhase(t.id);
    if (!phase) continue;
    byPhase.set(phase, t);
  }

  // If empty, return default shell pending (engine createTaskShell shape)
  const phases = byPhase.size > 0 ? PHASE_ORDER.filter((p) => byPhase.has(p)) : PHASE_ORDER;

  return phases.map((phase) => {
    const t = byPhase.get(phase);
    return {
      id: phase,
      label: PHASE_LABELS[phase],
      status: t ? asStatus(t.status) : "pending",
    };
  });
}

export function buildPipelineProgress(input: {
  tasks: readonly EngineTaskLike[] | null | undefined;
  simulationStatus: "queued" | "running" | "completed" | "failed" | string;
  chosenFutureId: string | null | undefined;
  dwellMs?: number;
}): PipelineProgress {
  const lifecycle = mapEngineTasksToLifecycle(input.tasks);
  const decideComplete = Boolean(
    typeof input.chosenFutureId === "string" && input.chosenFutureId.trim()
  );
  const dwellMs = clampPhaseDwellMs(input.dwellMs);

  const computeDone =
    input.simulationStatus === "completed" &&
    lifecycle.length > 0 &&
    lifecycle.every((e) => e.status === "completed" || e.status === "failed");

  const stages: DecisionStageProgress[] = [
    {
      id: "understand",
      label: STAGE_LABELS.understand,
      complete: isPhaseDone(lifecycle, "plan"),
    },
    {
      id: "explore",
      label: STAGE_LABELS.explore,
      complete: isPhaseDone(lifecycle, "generate"),
    },
    {
      id: "evaluate",
      label: STAGE_LABELS.evaluate,
      complete: isPhaseDone(lifecycle, "evaluate") && isPhaseDone(lifecycle, "rank"),
    },
    {
      id: "recommend",
      label: STAGE_LABELS.recommend,
      complete: computeDone || isPhaseDone(lifecycle, "collapse"),
    },
    {
      id: "decide",
      label: STAGE_LABELS.decide,
      complete: decideComplete,
    },
  ];

  let activeLifecycleIndex = lifecycle.findIndex(
    (e) => e.status === "running" || e.status === "pending"
  );
  if (activeLifecycleIndex < 0) {
    activeLifecycleIndex = Math.max(0, lifecycle.length - 1);
  }

  return {
    lifecycle,
    stages,
    activeLifecycleIndex,
    decideComplete,
    dwellMs,
  };
}

function isPhaseDone(lifecycle: readonly LifecycleEvent[], phase: EngineTaskPhase): boolean {
  const ev = lifecycle.find((e) => e.id === phase);
  return ev?.status === "completed";
}
