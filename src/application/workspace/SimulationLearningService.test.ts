import { describe, expect, it } from "vitest";
import { collapse, createEngine, evaluate, fork } from "../chronos/engine";
import { getScenario } from "../../domain/chronos/scenarios";
import { SimulationLearningService } from "./SimulationLearningService";

describe("SimulationLearningService", () => {
  it("turns a completed simulation into workspace evidence for later planning", () => {
    const scenario = getScenario("robot-arm");
    const completed = collapse(
      evaluate(fork(createEngine(scenario.id, scenario.initialState, scenario.actions))),
      "max-utility"
    );

    const learning = new SimulationLearningService().derive(completed, {
      workspaceId: "workspace-demo",
      now: "2026-01-01T00:00:00.000Z",
    });

    expect(learning.pastSimulations).toEqual([
      expect.objectContaining({ simulationId: completed.id, status: "completed" }),
    ]);
    expect(learning.successfulFutures).toEqual([
      expect.objectContaining({ hypothesis: "Grasp directly", score: 0.82 }),
    ]);
    expect(learning.failurePatterns.map((pattern) => pattern.pattern)).toContain("human near");
    expect(learning.memories).toHaveLength(
      learning.successfulFutures.length + learning.failurePatterns.length
    );
    expect(learning.knowledgeGraph.nodes).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: completed.id, type: "simulation" })])
    );
  });
});
