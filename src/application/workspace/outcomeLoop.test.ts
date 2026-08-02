import { beforeEach, describe, expect, it } from "vitest";
import {
  type OutcomeSignal,
  selectWeightedPreferences,
} from "../../domain/workspace/outcomeLearning";
import type { WorkspaceHome } from "../../domain/workspace/types";
import type { LearningMemoryRecord } from "../../domain/workspace/productLearning";
import { learningMemoryStore } from "../../infrastructure/memory/LearningMemoryStore";
import { LocalWorkspaceStore } from "../../infrastructure/repositories/LocalWorkspaceStore";
import { registerProductEventSubscribers } from "../runtime/productEventSubscribers";
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
    // Prediction-time records ("Predicted best future") are written by the
    // DecisionRanked subscriber, not by the service. That registration used to
    // happen as a side effect of importing WorkspaceService; it now belongs to
    // the composition root, so a test that asserts on those records has to ask
    // for them. Idempotent.
    registerProductEventSubscribers({ track: () => {} });
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

  /** Drive any service to a collapsed decision, whatever it was wired with. */
  async function runToChosenPath(service: WorkspaceService, name: string) {
    await service.createWorkspace(ownerId, name, "");
    await service.setGoal(ownerId, "Launch the public beta");
    const afterRun = await service.runSimulation(ownerId, "How should we launch?", []);
    const sim = afterRun.recentSimulations[0];
    if (!sim) throw new Error("expected a simulation");
    const futures = afterRun.futuresBySimulation[sim.id] ?? [];
    if (futures.length === 0) throw new Error("expected futures");
    await service.chooseBestPath(ownerId, sim.id, futures[0]!.id);
    return { simulationId: sim.id };
  }

  async function seedRunWithChosenPath() {
    // The memory store is injected rather than reached for: WorkspaceService
    // owns the learning rules, not the choice of where records land.
    const service = new WorkspaceService({
      local: new LocalWorkspaceStore(),
      remote: null,
      memory: learningMemoryStore,
    });
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

  it("writes outcome learning to the injected port, not to a store it picked", async () => {
    const appended: LearningMemoryRecord[] = [];
    const fakeMemory = {
      list: () => appended,
      append: (_workspaceId: string, records: readonly LearningMemoryRecord[]) => {
        appended.push(...records);
        return records.length;
      },
    };
    const service = new WorkspaceService({
      local: new LocalWorkspaceStore(),
      remote: null,
      memory: fakeMemory,
    });
    const { simulationId } = await runToChosenPath(service, "Fake Memory");

    await service.recordOutcomeFollowed(ownerId, simulationId, "yes");
    await service.recordOutcomeResult(ownerId, simulationId, "Churn doubled.", "worse");

    expect(appended.some((r) => r.metadata.observed === true)).toBe(true);
  });

  it("completes the loop with no memory port at all", async () => {
    // Learning is an enhancement, not a precondition. Before the port existed
    // this was unaskable: the store was imported, so there was no
    // configuration in which it could be absent.
    const service = new WorkspaceService({ local: new LocalWorkspaceStore(), remote: null });
    const { simulationId } = await runToChosenPath(service, "No Memory");

    await service.recordOutcomeFollowed(ownerId, simulationId, "yes");
    const home = await service.recordOutcomeResult(ownerId, simulationId, "Fine.", "better");

    expect(home.recentSimulations[0]?.result.outcome_verdict).toBe("better");
  });
});
