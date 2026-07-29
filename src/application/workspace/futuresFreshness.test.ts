import { beforeEach, describe, expect, it } from "vitest";
import { LocalWorkspaceStore } from "../../infrastructure/repositories/LocalWorkspaceStore";
import { isSampleSimulation } from "../../domain/workspace/sampleDecision";
import { WorkspaceService } from "./WorkspaceService";

const OWNER = "anon-11111111-1111-4111-8111-111111111111";

describe("futures freshness", () => {
  let service: WorkspaceService;

  beforeEach(() => {
    localStorage.clear();
    service = new WorkspaceService({ local: new LocalWorkspaceStore(), remote: null });
  });

  it("gives each decision its own futures, not the previous run's", async () => {
    await service.createWorkspace(OWNER, "Lab");
    await service.setGoal(OWNER, "Grow");

    let home = await service.runSimulation(OWNER, "Should we hire a senior backend engineer?");
    const first = home.recentSimulations[0];
    const firstFutures = home.futuresBySimulation[first.id]!;

    home = await service.runSimulation(OWNER, "Should we move our pricing to usage-based?");
    const second = home.recentSimulations[0];
    const secondFutures = home.futuresBySimulation[second.id]!;

    // Distinct records, distinct future ids — nothing reused.
    expect(second.id).not.toBe(first.id);
    expect(secondFutures.map((f) => f.id)).not.toEqual(firstFutures.map((f) => f.id));
    // Both still hold their own futures after the second run.
    expect(home.futuresBySimulation[first.id]!.map((f) => f.id)).toEqual(
      firstFutures.map((f) => f.id)
    );
  });

  it("does not leave the sample's futures attached to a real run", async () => {
    await service.seedSampleDecision(OWNER);
    const seeded = await service.load(OWNER);
    const sampleId = seeded!.recentSimulations.find(isSampleSimulation)!.id;

    await service.setGoal(OWNER, "My own goal");
    const home = await service.runSimulation(OWNER, "What should we actually decide?");
    const real = home.recentSimulations[0];

    // Sample purged, and its relations went with it — no orphaned futures.
    expect(home.recentSimulations.some(isSampleSimulation)).toBe(false);
    expect(home.futuresBySimulation[sampleId]).toBeUndefined();
    expect(home.futuresBySimulation[real.id]!.length).toBeGreaterThanOrEqual(2);
  });

  it("re-running the same objective produces a fresh record, not a cached one", async () => {
    await service.createWorkspace(OWNER, "Lab");
    await service.setGoal(OWNER, "Grow");
    const objective = "Should we launch in Europe first?";

    let home = await service.runSimulation(OWNER, objective);
    const first = home.recentSimulations[0];

    home = await service.rerunSimulation(OWNER, first.id);
    const second = home.recentSimulations[0];

    expect(second.id).not.toBe(first.id);
    expect(second.version).toBeGreaterThan(first.version);
    // A rerun must generate its own futures rather than pointing at the parent's.
    const secondFutures = home.futuresBySimulation[second.id]!;
    expect(secondFutures.length).toBeGreaterThanOrEqual(2);
    expect(secondFutures.every((f) => f.simulation_id === second.id)).toBe(true);
  });
});
