/**
 * Dual-write decision loop: local always commits; cloud is best-effort.
 * Validates save/load/choose path survive remote failures and merge correctly.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { LocalWorkspaceStore } from "../../infrastructure/repositories/LocalWorkspaceStore";
import type { WorkspaceHome } from "../../domain/workspace/types";
import { WorkspaceService, type WorkspaceCloudStore } from "./WorkspaceService";

function memoryCloud(): WorkspaceCloudStore & {
  homes: Map<string, WorkspaceHome>;
  /** Number of upcoming save() calls that should fail (sim run dual-persists). */
  failSaves: number;
  saveCalls: number;
} {
  const homes = new Map<string, WorkspaceHome>();
  const store = {
    homes,
    failSaves: 0,
    saveCalls: 0,
    async list(ownerId: string) {
      return [...homes.values()]
        .filter((h) => h.workspace.owner_id === ownerId)
        .map((h) => h.workspace);
    },
    async load(ownerId: string, workspaceId?: string) {
      const matches = [...homes.values()].filter(
        (h) =>
          h.workspace.owner_id === ownerId &&
          (!workspaceId || h.workspace.id === workspaceId)
      );
      return matches[0] ?? null;
    },
    async save(home: WorkspaceHome) {
      store.saveCalls += 1;
      if (store.failSaves > 0) {
        store.failSaves -= 1;
        throw Object.assign(new Error("simulated cloud outage"), {
          code: "PGRST301",
        });
      }
      homes.set(home.workspace.id, structuredClone(home));
    },
  };
  return store;
}

describe("WorkspaceService dual-write", () => {
  const ownerId = "dual-write-user";
  let local: LocalWorkspaceStore;
  let cloud: ReturnType<typeof memoryCloud>;
  let service: WorkspaceService;

  beforeEach(() => {
    localStorage.clear();
    local = new LocalWorkspaceStore();
    cloud = memoryCloud();
    service = new WorkspaceService({ local, remote: cloud });
  });

  it("keeps local decision memory when cloud save fails", async () => {
    let home = await service.createWorkspace(ownerId, "Cloud Lab");
    home = await service.setGoal(ownerId, "Ship decision loop");
    home = await service.runSimulation(ownerId, "Which path?", ["low risk"]);
    const simId = home.recentSimulations[0].id;
    const futureId = home.futuresBySimulation[simId][0].id;

    cloud.failSaves = 1;
    home = await service.chooseBestPath(ownerId, simId, futureId);

    expect(home.recentSimulations[0].result.chosen_future_id).toBe(futureId);
    expect(service.getRemoteError()).toMatch(/cloud outage|PGRST301/i);

    // Local resume still has the collapse
    const resumed = await new WorkspaceService({ local, remote: null }).load(ownerId);
    expect(resumed?.recentSimulations[0].result.chosen_future_id).toBe(futureId);
    // Engine returns up to 5 ranked futures (honest catalog may yield fewer).
    const futures = resumed?.futuresBySimulation[simId] ?? [];
    expect(futures.length).toBeGreaterThanOrEqual(2);
    expect(futures.length).toBeLessThanOrEqual(5);
  });

  it("writes through after cloud recovers and merges local-only sims", async () => {
    await service.createWorkspace(ownerId, "Merge Lab");
    await service.setGoal(ownerId, "Goal");
    // Offline-style: fail both dual-write persists in runSimulation (running + completed)
    cloud.failSaves = 2;
    let home = await service.runSimulation(ownerId, "Offline sim");
    const simId = home.recentSimulations[0].id;
    expect(service.getRemoteError()).toBeTruthy();

    // Cloud still has create/setGoal only — not the offline sim
    const cloudHome = await cloud.load(ownerId);
    expect(cloudHome?.recentSimulations.some((s) => s.id === simId)).toBeFalsy();

    // Successful load path: merge remote + local then write-through
    service = new WorkspaceService({ local, remote: cloud });
    home = (await service.load(ownerId))!;
    expect(home.recentSimulations.some((s) => s.id === simId)).toBe(true);
    expect(service.getRemoteError()).toBeNull();
    expect(cloud.homes.size).toBe(1);
    expect(
      [...cloud.homes.values()][0].recentSimulations.some((s) => s.id === simId)
    ).toBe(true);
  });

  it("merges remote + local simulations without dropping either side", async () => {
    const a = await service.createWorkspace(ownerId, "Shared");
    await service.setGoal(ownerId, "Goal");
    await service.runSimulation(ownerId, "Remote first");
    // Snapshot cloud as "remote device"
    const remoteSnapshot = structuredClone(cloud.homes.get(a.workspace.id)!);

    // Local-only second sim while cloud is down (2 persists per run)
    cloud.failSaves = 2;
    await service.runSimulation(ownerId, "Local second");
    const localOnly = await new WorkspaceService({ local, remote: null }).load(ownerId);
    expect(localOnly!.recentSimulations).toHaveLength(2);

    // Restore cloud to only the first sim (other device)
    cloud.homes.set(a.workspace.id, remoteSnapshot);
    cloud.failSaves = 0;

    const merged = await new WorkspaceService({ local, remote: cloud }).load(ownerId);
    expect(merged!.recentSimulations).toHaveLength(2);
    expect(merged!.recentSimulations.map((s) => s.title).sort()).toEqual([
      "Local second",
      "Remote first",
    ]);
  });
});
