import { beforeEach, describe, expect, it } from "vitest";
import { LocalWorkspaceStore } from "../../infrastructure/repositories/LocalWorkspaceStore";
import {
  isSampleSimulation,
  withoutSampleSimulations,
} from "../../domain/workspace/sampleDecision";
import { WorkspaceService } from "./WorkspaceService";

const OWNER = "anon-11111111-1111-4111-8111-111111111111";

describe("sample decision seeding", () => {
  let store: LocalWorkspaceStore;
  let service: WorkspaceService;

  beforeEach(() => {
    localStorage.clear();
    store = new LocalWorkspaceStore();
    service = new WorkspaceService({ local: store, remote: null });
  });

  it("seeds a collapsed decision a visitor can explore", async () => {
    const home = await service.seedSampleDecision(OWNER);

    const sample = home.recentSimulations.find(isSampleSimulation);
    expect(sample).toBeDefined();
    expect(sample!.status).toBe("completed");
    // Collapsed, so the visitor sees the whole loop rather than a half-run.
    expect(sample!.result.chosen_future_id).toBeTruthy();
    expect(home.futuresBySimulation[sample!.id]!.length).toBeGreaterThanOrEqual(2);
  });

  it("ranks the sample with the real engine, not fixtures", async () => {
    // The honesty constraint: a fabricated ranking, in a product whose claim is
    // deterministic ranking, would be the worst thing to ship.
    //
    // Asserted by outcome rather than by replaying the engine with hand-built
    // inputs — that would couple this test to how runSimulation assembles its
    // payload. These properties cannot be produced by hand-written fixtures
    // without actually running the engine.
    const home = await service.seedSampleDecision(OWNER);
    const sample = home.recentSimulations.find(isSampleSimulation)!;
    const futures = home.futuresBySimulation[sample.id]!;

    // Engine artifacts: a fixture would have to fake all of these coherently.
    expect(sample.result.futures_count).toBe(futures.length);
    expect(sample.result.best_future).toBeTruthy();
    expect(sample.result.recommendation).toBeTruthy();
    expect(Array.isArray(sample.result.tasks)).toBe(true);
    expect(
      (sample.result.tasks as { status: string }[]).every((t) => t.status === "completed")
    ).toBe(true);

    // Engine-owned ranking: descending score, real bounds, distinct paths.
    const scores = futures.map((f) => f.score);
    expect([...scores].sort((a, b) => b - a)).toEqual(scores);
    for (const f of futures) {
      expect(f.score).toBeGreaterThan(0);
      expect(f.score).toBeLessThanOrEqual(1);
      expect(f.name.length).toBeGreaterThan(0);
    }
    expect(new Set(futures.map((f) => f.name)).size).toBe(futures.length);

    // The collapse follows the engine's ranking, not an arbitrary pick.
    expect(sample.result.chosen_future_name).toBe(futures[0]!.name);
  });

  it("keeps the sample's futures after a reload", async () => {
    // The UI reads futuresBySimulation after load(), not straight off the seed
    // return value — the decision graph does not render without them.
    await service.seedSampleDecision(OWNER);
    const reloaded = await service.load(OWNER);
    const sample = reloaded!.recentSimulations.find(isSampleSimulation)!;

    expect(reloaded!.futuresBySimulation[sample.id]?.length).toBeGreaterThanOrEqual(2);
  });

  it("re-seeds a sample left stuck mid-flight", async () => {
    // A visitor who navigates while the seed is running leaves a persisted
    // "running" record. Treating that as already-seeded would strand them with
    // a sample that never ranks anything.
    const seeded = await service.seedSampleDecision(OWNER);
    const sample = seeded.recentSimulations.find(isSampleSimulation)!;
    store.save(OWNER, {
      ...seeded,
      recentSimulations: [{ ...sample, status: "running", result: { is_sample: true } }],
    });

    const home = await service.seedSampleDecision(OWNER);
    const reseeded = home.recentSimulations.filter(isSampleSimulation);

    expect(reseeded).toHaveLength(1);
    expect(reseeded[0]!.status).toBe("completed");
    expect(home.futuresBySimulation[reseeded[0]!.id]?.length).toBeGreaterThanOrEqual(2);
  });

  it("seeds at most one sample", async () => {
    await service.seedSampleDecision(OWNER);
    const home = await service.seedSampleDecision(OWNER);

    expect(home.recentSimulations.filter(isSampleSimulation)).toHaveLength(1);
  });

  it("does not seed into a workspace that already has real work", async () => {
    await service.createWorkspace(OWNER, "Mine");
    await service.setGoal(OWNER, "Real objective");
    await service.runSimulation(OWNER, "A real question?");

    const home = await service.seedSampleDecision(OWNER);

    expect(home.recentSimulations.some(isSampleSimulation)).toBe(false);
  });

  it("drops the sample as soon as the user runs their own simulation", async () => {
    await service.seedSampleDecision(OWNER);
    const home = await service.runSimulation(OWNER, "My own question?");

    expect(home.recentSimulations.some(isSampleSimulation)).toBe(false);
    expect(withoutSampleSimulations(home.recentSimulations)).toHaveLength(1);
  });

  it("removes the sample and its relations on request", async () => {
    const seeded = await service.seedSampleDecision(OWNER);
    const sampleId = seeded.recentSimulations.find(isSampleSimulation)!.id;

    const home = await service.removeSampleDecision(OWNER);

    expect(home.recentSimulations.some(isSampleSimulation)).toBe(false);
    // Orphaned futures/timeline would linger in storage and in memory views.
    expect(home.futuresBySimulation[sampleId]).toBeUndefined();
    expect(home.timelineBySimulation[sampleId]).toBeUndefined();
  });
});
