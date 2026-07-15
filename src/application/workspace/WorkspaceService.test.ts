import { beforeEach, describe, expect, it } from "vitest";
import { LocalWorkspaceStore } from "../../infrastructure/repositories/LocalWorkspaceStore";
import { WorkspaceService } from "./WorkspaceService";

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

