import { beforeEach, describe, expect, it } from "vitest";
import {
  type OutcomeSignal,
  selectWeightedPreferences,
} from "../../domain/workspace/outcomeLearning";
import type { WorkspaceHome } from "../../domain/workspace/types";
import { learningMemoryStore } from "../../infrastructure/memory/LearningMemoryStore";
import { LocalWorkspaceStore } from "../../infrastructure/repositories/LocalWorkspaceStore";
import { WorkspaceService } from "./WorkspaceService";

/**
 * The outcome → priors loop, against real service state: a real run produces
 * real priors, a real logged outcome re-weights them.
 *
 * Priors are injected into the engine as soft constraints and are not echoed
 * back onto the persisted record, so these assert the selection the service
 * performs (same call, same inputs) rather than a field that cannot observe it.
 */
describe("outcome learning loop", () => {
  const ownerId = "user-loop-1";

  beforeEach(() => {
    localStorage.clear();
    learningMemoryStore.clear();
  });

  /** Mirrors how WorkspaceService builds its outcome map before a run. */
  function outcomeMapFrom(home: WorkspaceHome): Record<string, OutcomeSignal> {
    const map: Record<string, OutcomeSignal> = {};
    for (const sim of home.recentSimulations) {
      map[sim.id] = {
        followed: sim.result.outcome_followed ?? null,
        verdict: sim.result.outcome_verdict ?? null,
      };
    }
    return map;
  }

  async function seedRunWithChosenPath() {
    const service = new WorkspaceService({ local: new LocalWorkspaceStore(), remote: null });
    const created = await service.createWorkspace(ownerId, "Loop Lab", "");
    await service.setGoal(ownerId, "Launch the public beta");
    await service.addKnowledge(ownerId, {
      type: "note",
      title: "Runway",
      content: "Small team, limited runway.",
    });
    const afterRun = await service.runSimulation(ownerId, "How should we launch?", []);
    const sim = afterRun.recentSimulations[0];
    if (!sim) throw new Error("expected a simulation");
    const futures = afterRun.futuresBySimulation[sim.id] ?? [];
    if (futures.length === 0) throw new Error("expected futures");
    const home = await service.chooseBestPath(ownerId, sim.id, futures[0]!.id);
    return { service, workspaceId: created.workspace.id, simulationId: sim.id, home };
  }

  it("logging an outcome writes observed memory the prediction snapshot never claimed", async () => {
    const { service, workspaceId, simulationId } = await seedRunWithChosenPath();

    const before = learningMemoryStore.list(workspaceId);
    expect(before.some((r) => r.metadata.observed === true)).toBe(false);
    // Prediction-time records must not assert success before anything happened.
    expect(before.some((r) => r.content.startsWith("Successful future"))).toBe(false);
    expect(before.some((r) => r.content.startsWith("Predicted best future"))).toBe(true);

    await service.recordOutcomeFollowed(ownerId, simulationId, "yes");
    await service.recordOutcomeResult(ownerId, simulationId, "Churn doubled.", "worse");

    const observed = learningMemoryStore.list(workspaceId).filter((r) => r.metadata.observed);
    expect(observed.length).toBeGreaterThan(0);
    expect(observed.some((r) => r.content.includes("Outcome missed the prediction"))).toBe(true);
  });

  it("a run whose outcome missed stops steering the next simulation", async () => {
    const { service, workspaceId, simulationId } = await seedRunWithChosenPath();

    const priorHints = learningMemoryStore
      .list(workspaceId)
      .filter((r) => r.kind === "preference" && r.simulationId === simulationId)
      .map((r) => r.content);
    // Guards against a vacuous assertion: the run must have produced priors.
    expect(priorHints.length).toBeGreaterThan(0);

    await service.recordOutcomeFollowed(ownerId, simulationId, "yes");
    const home = await service.recordOutcomeResult(ownerId, simulationId, "Missed.", "worse");

    const selected = selectWeightedPreferences(
      learningMemoryStore.list(workspaceId),
      outcomeMapFrom(home),
      3
    );
    for (const hint of priorHints) {
      expect(selected).not.toContain(hint);
    }
  });

  it("keeps feeding priors when the outcome held", async () => {
    const { service, workspaceId, simulationId } = await seedRunWithChosenPath();

    await service.recordOutcomeFollowed(ownerId, simulationId, "yes");
    const home = await service.recordOutcomeResult(ownerId, simulationId, "Went well.", "better");

    const priorHints = learningMemoryStore
      .list(workspaceId)
      .filter((r) => r.kind === "preference")
      .map((r) => r.content);
    const selected = selectWeightedPreferences(
      learningMemoryStore.list(workspaceId),
      outcomeMapFrom(home),
      3
    );
    expect(selected.length).toBeGreaterThan(0);
    expect(priorHints).toEqual(expect.arrayContaining(selected));
  });

  it("without a logged outcome the prior still feeds the next run (unchanged behavior)", async () => {
    const { workspaceId, home } = await seedRunWithChosenPath();

    const priorHints = learningMemoryStore
      .list(workspaceId)
      .filter((r) => r.kind === "preference")
      .map((r) => r.content);
    expect(priorHints.length).toBeGreaterThan(0);

    const selected = selectWeightedPreferences(
      learningMemoryStore.list(workspaceId),
      outcomeMapFrom(home),
      3
    );
    expect(selected.length).toBeGreaterThan(0);
    expect(priorHints).toEqual(expect.arrayContaining(selected));
  });
});
