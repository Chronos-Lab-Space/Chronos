import { describe, expect, it } from "vitest";
import {
  DEFAULT_PHASE_DWELL_MS,
  buildPipelineProgress,
  mapEngineTasksToLifecycle,
  type EngineTaskLike,
} from "./decisionPipeline";

const completedTasks: EngineTaskLike[] = [
  { id: "plan", title: "Planner", status: "completed", phase: "plan" },
  { id: "generate", title: "Generate futures", status: "completed", phase: "generate" },
  { id: "evaluate", title: "Evaluate", status: "completed", phase: "evaluate" },
  { id: "rank", title: "Rank", status: "completed", phase: "rank" },
  { id: "collapse", title: "Best future", status: "completed", phase: "collapse" },
];

describe("mapEngineTasksToLifecycle", () => {
  it("maps engine phases to product lifecycle labels in order", () => {
    const events = mapEngineTasksToLifecycle(completedTasks);
    expect(events.map((e) => e.id)).toEqual(["plan", "generate", "evaluate", "rank", "collapse"]);
    expect(events[0].label).toMatch(/understanding goal/i);
    expect(events[1].label).toMatch(/generating candidate futures/i);
    expect(events[2].label).toMatch(/evaluating trade-offs/i);
    expect(events[3].label).toMatch(/ranking outcomes/i);
    expect(events[4].label).toMatch(/preparing decision report/i);
    expect(events.every((e) => e.status === "completed")).toBe(true);
  });

  it("preserves running/pending/failed status from engine tasks", () => {
    const tasks: EngineTaskLike[] = [
      { id: "plan", status: "completed", phase: "plan" },
      { id: "generate", status: "running", phase: "generate" },
      { id: "evaluate", status: "pending", phase: "evaluate" },
    ];
    const events = mapEngineTasksToLifecycle(tasks);
    expect(events.map((e) => e.status)).toEqual(["completed", "running", "pending"]);
  });
});

describe("buildPipelineProgress", () => {
  it("marks compute phases complete and decide incomplete without chosen path", () => {
    const progress = buildPipelineProgress({
      tasks: completedTasks,
      simulationStatus: "completed",
      chosenFutureId: null,
    });
    expect(progress.lifecycle.every((e) => e.status === "completed")).toBe(true);
    expect(progress.decideComplete).toBe(false);
    expect(progress.stages.find((s) => s.id === "decide")?.complete).toBe(false);
    expect(progress.stages.filter((s) => s.id !== "decide").every((s) => s.complete)).toBe(true);
  });

  it("marks decide complete when chosen_future_id is set", () => {
    const progress = buildPipelineProgress({
      tasks: completedTasks,
      simulationStatus: "completed",
      chosenFutureId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
    });
    expect(progress.decideComplete).toBe(true);
    expect(progress.stages.find((s) => s.id === "decide")?.complete).toBe(true);
  });

  it("exposes min dwell in the 200–400ms band (default 300)", () => {
    expect(DEFAULT_PHASE_DWELL_MS).toBeGreaterThanOrEqual(200);
    expect(DEFAULT_PHASE_DWELL_MS).toBeLessThanOrEqual(400);
    const progress = buildPipelineProgress({
      tasks: completedTasks,
      simulationStatus: "completed",
      chosenFutureId: null,
      dwellMs: 250,
    });
    expect(progress.dwellMs).toBe(250);
  });

  it("clamps dwellMs into 200–400", () => {
    expect(
      buildPipelineProgress({
        tasks: completedTasks,
        simulationStatus: "completed",
        chosenFutureId: null,
        dwellMs: 50,
      }).dwellMs
    ).toBe(200);
    expect(
      buildPipelineProgress({
        tasks: completedTasks,
        simulationStatus: "completed",
        chosenFutureId: null,
        dwellMs: 999,
      }).dwellMs
    ).toBe(400);
  });

  it("active lifecycle index is first non-completed phase, or last when all done", () => {
    const mid = buildPipelineProgress({
      tasks: [
        { id: "plan", status: "completed", phase: "plan" },
        { id: "generate", status: "running", phase: "generate" },
        { id: "evaluate", status: "pending", phase: "evaluate" },
      ],
      simulationStatus: "running",
      chosenFutureId: null,
    });
    expect(mid.activeLifecycleIndex).toBe(1);

    const done = buildPipelineProgress({
      tasks: completedTasks,
      simulationStatus: "completed",
      chosenFutureId: null,
    });
    expect(done.activeLifecycleIndex).toBe(completedTasks.length - 1);
  });
});
