import { beforeEach, describe, expect, it } from "vitest";
import type { SimulationRecord, WorkspaceHome } from "../../domain/workspace/types";
import { LocalWorkspaceStore } from "../../infrastructure/repositories/LocalWorkspaceStore";
import {
  MAX_RETAINED_SIMULATIONS,
  WorkspaceService,
  type WorkspaceCloudStore,
} from "./WorkspaceService";

/**
 * Dropping a simulation locally used to leave the cloud copy behind, because
 * the repository has deleteKnowledge and deleteNote but nothing for
 * simulations. That is not only wasted rows: `load` merges remote into local,
 * so a dropped sample comes back on the next visit.
 *
 * Retention trimming is deliberately *not* a delete — see the last test.
 */

function ownerHome(ownerId: string, sims: readonly SimulationRecord[]): WorkspaceHome {
  return {
    workspace: {
      id: "w-prune",
      owner_id: ownerId,
      name: "Prune Lab",
      description: "",
      created_at: "2026-01-01T00:00:00.000Z",
    },
    goal: null,
    goalHistory: [],
    recentSimulations: sims,
    knowledge: [],
    notes: [],
    futuresBySimulation: {},
    timelineBySimulation: {},
  };
}

function sim(id: string, createdAt: string, isSample = false): SimulationRecord {
  return {
    id,
    workspace_id: "w-prune",
    goal_id: null,
    title: id,
    status: "completed",
    confidence: 0.7,
    result: isSample ? { is_sample: true } : {},
    created_at: createdAt,
    version: 1,
    lineage_id: id,
    parent_simulation_id: null,
  };
}

function memoryCloud() {
  const homes = new Map<string, WorkspaceHome>();
  const deleted: string[] = [];
  let failDeletes = false;

  const store: WorkspaceCloudStore & {
    homes: Map<string, WorkspaceHome>;
    deleted: string[];
    setFailDeletes(v: boolean): void;
  } = {
    homes,
    deleted,
    setFailDeletes(v: boolean) {
      failDeletes = v;
    },
    async list(ownerId: string) {
      return [...homes.values()]
        .filter((h) => h.workspace.owner_id === ownerId)
        .map((h) => h.workspace);
    },
    async load(ownerId: string) {
      return [...homes.values()].find((h) => h.workspace.owner_id === ownerId) ?? null;
    },
    async save(home: WorkspaceHome) {
      // Model save_workspace_home honestly: it upserts by id and never
      // deletes, so a row absent from the payload survives. Replacing the
      // stored home wholesale would make the resurrection test below pass
      // for the wrong reason.
      const existing = homes.get(home.workspace.id);
      const byId = new Map((existing?.recentSimulations ?? []).map((s) => [s.id, s]));
      for (const s of home.recentSimulations) byId.set(s.id, s);
      homes.set(home.workspace.id, {
        ...structuredClone(home),
        recentSimulations: [...byId.values()],
      });
    },
    async deleteSimulations(ids: readonly string[]) {
      if (failDeletes) throw new Error("simulated cloud outage");
      deleted.push(...ids);
      for (const home of homes.values()) {
        homes.set(home.workspace.id, {
          ...home,
          recentSimulations: home.recentSimulations.filter((s) => !ids.includes(s.id)),
        });
      }
    },
  };
  return store;
}

describe("pruned simulations reach the cloud", () => {
  const ownerId = "prune-user";
  let local: LocalWorkspaceStore;
  let cloud: ReturnType<typeof memoryCloud>;
  let service: WorkspaceService;

  beforeEach(() => {
    localStorage.clear();
    local = new LocalWorkspaceStore();
    cloud = memoryCloud();
    service = new WorkspaceService({ local, remote: cloud });
  });

  async function seedWithSample() {
    const home = ownerHome(ownerId, [sim("sample-1", "2026-02-01T00:00:00.000Z", true)]);
    cloud.homes.set(home.workspace.id, structuredClone(home));
    local.save(ownerId, home);
    return home;
  }

  it("deletes the sample in the cloud when the visitor runs their own decision", async () => {
    await seedWithSample();

    await service.runSimulation(ownerId, "Should we raise before launch?", []);

    expect(cloud.deleted).toContain("sample-1");
  });

  it("does not resurrect a dropped sample on the next load", async () => {
    await seedWithSample();
    await service.runSimulation(ownerId, "Should we raise before launch?", []);

    // load() merges remote into local. If the cloud still held the sample,
    // the visitor would see the demo reappear beside their real work.
    const reloaded = await service.load(ownerId);

    expect(reloaded?.recentSimulations.some((s) => s.id === "sample-1")).toBe(false);
  });

  it("keeps the local drop when the cloud delete fails", async () => {
    await seedWithSample();
    cloud.setFailDeletes(true);

    const home = await service.runSimulation(ownerId, "Should we raise before launch?", []);

    // Best-effort, exactly like deleteKnowledge and deleteNote: the local
    // copy is authoritative for the user's next action.
    expect(home.recentSimulations.some((s) => s.id === "sample-1")).toBe(false);
  });

  it("never deletes cloud history just because the local window is full", async () => {
    // Retention is a *local* bound — localStorage quota — not a statement
    // that the user's older decisions should cease to exist. Deleting
    // durable history to satisfy a cache limit would be irreversible, and
    // since #83 the cloud write no longer grows with history anyway.
    const many = Array.from({ length: MAX_RETAINED_SIMULATIONS + 5 }, (_, i) =>
      sim(
        `s-${String(i).padStart(3, "0")}`,
        `2026-03-${String((i % 28) + 1).padStart(2, "0")}T00:00:00.000Z`
      )
    );
    const home = ownerHome(ownerId, many);
    cloud.homes.set(home.workspace.id, structuredClone(home));

    const loaded = await service.load(ownerId);

    expect(loaded?.recentSimulations.length).toBe(MAX_RETAINED_SIMULATIONS);
    expect(cloud.deleted).toEqual([]);
  });
});
