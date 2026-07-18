import { beforeEach, describe, expect, it } from "vitest";
import type { WorkspaceHome, WorkspaceRecord } from "../../domain/workspace/types";
import { LocalWorkspaceStore } from "../../infrastructure/repositories/LocalWorkspaceStore";
import { WorkspaceService, type WorkspaceCloudStore } from "./WorkspaceService";

/** In-memory cloud double for sync tests. */
class FakeCloudStore implements WorkspaceCloudStore {
  homes = new Map<string, WorkspaceHome>();

  async list(ownerId: string): Promise<WorkspaceRecord[]> {
    return [...this.homes.values()]
      .filter((h) => h.workspace.owner_id === ownerId)
      .map((h) => h.workspace);
  }

  async load(ownerId: string, workspaceId?: string): Promise<WorkspaceHome | null> {
    const matches = [...this.homes.values()].filter((h) => h.workspace.owner_id === ownerId);
    if (workspaceId) return matches.find((h) => h.workspace.id === workspaceId) ?? null;
    return matches[0] ?? null;
  }

  async save(home: WorkspaceHome): Promise<void> {
    this.homes.set(home.workspace.id, structuredClone(home));
  }
}

describe("WorkspaceService success metric", () => {
  const ownerId = "user-test-1";
  let store: LocalWorkspaceStore;
  let service: WorkspaceService;

  beforeEach(() => {
    localStorage.clear();
    store = new LocalWorkspaceStore();
    // Local-only (no Supabase) for deterministic unit tests
    service = new WorkspaceService({ local: store, remote: null });
  });

  it("lets a user create a workspace, set a goal, add context, run a sim, and resume", async () => {
    expect(await service.load(ownerId)).toBeNull();

    let home = await service.createWorkspace(ownerId, "Chronos Lab", "Product HQ");
    expect(home.workspace.name).toBe("Chronos Lab");
    expect(home.workspace.description).toBe("Product HQ");
    expect(home.goal).toBeNull();
    expect(home.recentSimulations).toEqual([]);

    home = await service.setGoal(ownerId, "Launch CLAB on Kickstart", "Public launch path", 1);
    expect(home.goal?.title).toBe("Launch CLAB on Kickstart");
    expect(home.goal?.status).toBe("active");
    expect(home.goal?.priority).toBe(1);

    home = await service.addKnowledge(ownerId, {
      type: "pdf",
      title: "Kickstart brief.pdf",
      content: "outline",
    });
    home = await service.addKnowledge(ownerId, {
      type: "url",
      title: "https://chronoslab.space",
      metadata: { url: "https://chronoslab.space" },
    });
    home = await service.addNote(ownerId, "Launch constraints", "Ship demo + waitlist");
    expect(home.knowledge.length).toBeGreaterThanOrEqual(3);
    expect(home.notes).toHaveLength(1);

    home = await service.runSimulation(ownerId, "Should we raise funding before Kickstart?", [
      "no raise before launch",
    ]);
    expect(home.recentSimulations).toHaveLength(1);
    const sim = home.recentSimulations[0];
    expect(sim.status).toBe("completed");
    expect(sim.title).toContain("funding");
    expect(sim.version).toBe(1);
    expect(sim.lineage_id).toBeTruthy();
    expect(sim.parent_simulation_id).toBeNull();
    expect(sim.result.futures_count).toBe(5);
    expect(sim.result.best_future).toBeTruthy();
    expect(sim.result.recommendation).toBeTruthy();
    expect(Array.isArray(sim.result.risks)).toBe(true);
    expect(Array.isArray(sim.result.tasks)).toBe(true);
    expect(sim.confidence).toBeGreaterThan(0);
    expect(home.futuresBySimulation[sim.id]).toHaveLength(5);
    expect(home.timelineBySimulation[sim.id]?.length).toBeGreaterThan(0);

    home = await service.rerunSimulation(ownerId, sim.id);
    expect(home.recentSimulations).toHaveLength(2);
    const v2 = home.recentSimulations[0];
    expect(v2.version).toBe(2);
    expect(v2.lineage_id).toBe(sim.lineage_id);
    expect(v2.parent_simulation_id).toBe(sim.id);
    expect(v2.status).toBe("completed");

    const resumed = await new WorkspaceService({ local: store, remote: null }).load(ownerId);
    expect(resumed).not.toBeNull();
    expect(resumed?.workspace.name).toBe("Chronos Lab");
    expect(resumed?.goal?.title).toBe("Launch CLAB on Kickstart");
    expect(resumed?.notes).toHaveLength(1);
    expect(resumed?.recentSimulations).toHaveLength(2);
    expect(resumed?.recentSimulations[0].id).toBe(v2.id);
    expect(resumed?.futuresBySimulation[sim.id]?.[0].name).toBeTruthy();
    expect(resumed?.futuresBySimulation[v2.id]?.length).toBe(5);
  });

  it("rejects empty names and requires a workspace before mutations", async () => {
    await expect(service.createWorkspace(ownerId, "   ")).rejects.toThrow(/name/i);
    await expect(service.setGoal(ownerId, "A goal")).rejects.toThrow(/workspace/i);

    await service.createWorkspace(ownerId, "Lab");
    await expect(service.setGoal(ownerId, "  ")).rejects.toThrow(/goal/i);
    await expect(service.runSimulation(ownerId, "")).rejects.toThrow(/objective/i);
  });

  it("creates additional workspaces without overwriting the first", async () => {
    const first = await service.createWorkspace(ownerId, "Alpha");
    await service.setGoal(ownerId, "Goal A");
    const second = await service.createWorkspace(ownerId, "Beta");
    expect(second.workspace.name).toBe("Beta");
    expect(second.goal).toBeNull();
    expect(second.workspace.id).not.toBe(first.workspace.id);

    const list = await service.listWorkspaces(ownerId);
    expect(list.map((w) => w.name).sort()).toEqual(["Alpha", "Beta"]);

    const switched = await service.switchWorkspace(ownerId, first.workspace.id);
    expect(switched.workspace.name).toBe("Alpha");
    expect(switched.goal?.title).toBe("Goal A");
  });
});

describe("WorkspaceService cloud memory sync", () => {
  const ownerId = "user-cloud-1";
  let local: LocalWorkspaceStore;
  let cloud: FakeCloudStore;

  beforeEach(() => {
    localStorage.clear();
    local = new LocalWorkspaceStore();
    cloud = new FakeCloudStore();
  });

  it("backfills local workspace to empty cloud on load", async () => {
    const offline = new WorkspaceService({ local, remote: null });
    let home = await offline.createWorkspace(ownerId, "Local Lab");
    home = await offline.setGoal(ownerId, "Ship beta");
    home = await offline.runSimulation(ownerId, "What is the best launch path?");
    expect(home.recentSimulations).toHaveLength(1);
    expect(cloud.homes.size).toBe(0);

    const online = new WorkspaceService({ local, remote: cloud });
    const loaded = await online.load(ownerId);
    expect(loaded?.recentSimulations).toHaveLength(1);
    expect(cloud.homes.size).toBe(1);
    const cloudHome = await cloud.load(ownerId);
    expect(cloudHome?.recentSimulations[0]?.title).toContain("launch");
    expect(cloudHome?.futuresBySimulation[home.recentSimulations[0].id]?.length).toBe(5);
  });

  it("merges local-only simulations with remote home on load", async () => {
    const online = new WorkspaceService({ local, remote: cloud });
    const remoteHome = await online.createWorkspace(ownerId, "Synced");
    await online.setGoal(ownerId, "Cloud goal");
    const afterRemoteSim = await online.runSimulation(ownerId, "Remote path A");
    const remoteSimId = afterRemoteSim.recentSimulations[0].id;

    // Simulate offline local-only run after a failed remote save by writing only to local
    const offline = new WorkspaceService({ local, remote: null });
    const afterLocalSim = await offline.runSimulation(ownerId, "Local path B");
    const localSimId = afterLocalSim.recentSimulations[0].id;
    expect(localSimId).not.toBe(remoteSimId);

    // Cloud still only has the first sim
    const cloudOnly = await cloud.load(ownerId);
    expect(cloudOnly?.recentSimulations).toHaveLength(1);

    const merged = await online.load(ownerId);
    const ids = merged?.recentSimulations.map((s) => s.id) ?? [];
    expect(ids).toContain(remoteSimId);
    expect(ids).toContain(localSimId);
    expect(merged?.futuresBySimulation[remoteSimId]?.length).toBe(5);
    expect(merged?.futuresBySimulation[localSimId]?.length).toBe(5);

    // Merge write-through should push the union back to cloud
    const cloudAfter = await cloud.load(ownerId);
    expect(cloudAfter?.recentSimulations.map((s) => s.id).sort()).toEqual(
      [localSimId, remoteSimId].sort()
    );
  });

  it("keeps local futures when remote save fails after a run", async () => {
    const flaky: WorkspaceCloudStore = {
      list: (id) => cloud.list(id),
      load: (id, ws) => cloud.load(id, ws),
      save: async () => {
        throw new Error("network down");
      },
    };
    const svc = new WorkspaceService({ local, remote: flaky });
    await svc.createWorkspace(ownerId, "Flaky");
    await svc.setGoal(ownerId, "Survive offline");
    const home = await svc.runSimulation(ownerId, "Can we still decide?");
    expect(home.recentSimulations).toHaveLength(1);
    expect(home.futuresBySimulation[home.recentSimulations[0].id]).toHaveLength(5);

    const resumed = await new WorkspaceService({ local, remote: null }).load(ownerId);
    expect(resumed?.recentSimulations).toHaveLength(1);
    expect(resumed?.futuresBySimulation[home.recentSimulations[0].id]?.length).toBe(5);
  });
});

