import { beforeEach, describe, expect, it } from "vitest";
import { groupDecisionsWithVersions } from "../../domain/workspace/decision";
import { LocalWorkspaceStore } from "../../infrastructure/repositories/LocalWorkspaceStore";
import type { SimulationRecord, WorkspaceHome } from "../../domain/workspace/types";
import { WorkspaceService, type WorkspaceCloudStore } from "./WorkspaceService";

/**
 * Success criteria 3 and 4 of SPEC-decision-object.md, through the real
 * service rather than the domain helper: a re-branch is a second *version* of
 * one decision, and an anonymous visitor gets decisions locally with nothing
 * written to Supabase.
 */

const OWNER = "anon-11111111-1111-4111-8111-111111111111";

describe("decisions follow the lineage", () => {
  let service: WorkspaceService;

  beforeEach(() => {
    localStorage.clear();
    service = new WorkspaceService({ local: new LocalWorkspaceStore(), remote: null });
  });

  it("a re-branch adds a version to the same decision, not a second one", async () => {
    await service.createWorkspace(OWNER, "Lab");
    await service.setGoal(OWNER, "Grow");

    let home = await service.runSimulation(OWNER, "Should we launch in Europe first?");
    const first = home.recentSimulations[0];

    home = await service.rerunSimulation(OWNER, first.id);
    const second = home.recentSimulations[0];

    expect(second.id).not.toBe(first.id);
    expect(second.decision_id).toBe(first.decision_id);
    expect(home.decisions).toHaveLength(1);

    const [group] = groupDecisionsWithVersions(home);
    expect(group.versions.map((v) => v.id)).toEqual([second.id, first.id]);
    expect(group.latest.id).toBe(second.id);
  });

  it("a different objective opens a different decision", async () => {
    await service.createWorkspace(OWNER, "Lab");
    await service.setGoal(OWNER, "Grow");

    await service.runSimulation(OWNER, "Should we hire a senior backend engineer?");
    const home = await service.runSimulation(OWNER, "Should we move to usage-based pricing?");

    expect(home.decisions).toHaveLength(2);
    expect(new Set(home.recentSimulations.map((s) => s.decision_id)).size).toBe(2);
  });

  it("names the decision after the question, and keeps that name across re-runs", async () => {
    await service.createWorkspace(OWNER, "Lab");
    await service.setGoal(OWNER, "Grow");

    const objective = "Should we launch in Europe first?";
    let home = await service.runSimulation(OWNER, objective);
    home = await service.rerunSimulation(OWNER, home.recentSimulations[0].id);

    expect(home.decisions[0].title).toBe(objective);
  });

  it("every simulation carries a decision, and it survives a reload", async () => {
    const store = new LocalWorkspaceStore();
    const first = new WorkspaceService({ local: store, remote: null });
    await first.createWorkspace(OWNER, "Lab");
    await first.setGoal(OWNER, "Grow");
    const before = await first.runSimulation(OWNER, "Should we launch in Europe first?");

    // A fresh service over the same storage — what a page reload does.
    const after = await new WorkspaceService({ local: store, remote: null }).load(OWNER);

    expect(after?.decisions.map((d) => d.id)).toEqual(before.decisions.map((d) => d.id));
    expect(after?.recentSimulations.every((s) => Boolean(s.decision_id))).toBe(true);
  });

  it("gives an anonymous visitor decisions without writing anything to the cloud", async () => {
    // `remote: null` is how the anonymous service is wired. If decisions were
    // a cloud-only concept this would produce none.
    const home = await service.createWorkspace(OWNER, "Lab").then(async () => {
      await service.setGoal(OWNER, "Grow");
      return service.runSimulation(OWNER, "Should we launch in Europe first?");
    });

    expect(home.decisions).toHaveLength(1);
    expect(home.decisions[0].workspace_id).toBe(home.workspace.id);
  });
});

describe("legacy rows already in the cloud", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("adopts simulations that arrive with no decision at all", async () => {
    // What the hosted project looked like before the backfill migration: rows
    // with a lineage and no decision_id. Loading must not leave them orphaned.
    const lineage = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
    const legacy = (id: string, version: number, createdAt: string): SimulationRecord => ({
      id,
      workspace_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      goal_id: null,
      title: "How should we launch?",
      status: "completed",
      confidence: 0.7,
      result: {},
      created_at: createdAt,
      version,
      lineage_id: lineage,
      parent_simulation_id: null,
    });

    const cloudHome: WorkspaceHome = {
      workspace: {
        id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        owner_id: OWNER,
        name: "Legacy Lab",
        description: "",
        created_at: "2026-01-01T00:00:00.000Z",
      },
      goal: null,
      goalHistory: [],
      decisions: [],
      recentSimulations: [
        legacy("00000000-0000-4000-8000-000000000002", 2, "2026-03-01T00:00:00.000Z"),
        legacy("00000000-0000-4000-8000-000000000001", 1, "2026-01-01T00:00:00.000Z"),
      ],
      knowledge: [],
      notes: [],
      futuresBySimulation: {},
      timelineBySimulation: {},
    };

    const remote: WorkspaceCloudStore = {
      list: async () => [cloudHome.workspace],
      load: async () => cloudHome,
      save: async () => {},
      deleteKnowledge: async () => {},
      deleteNote: async () => {},
    };

    const home = await new WorkspaceService({
      local: new LocalWorkspaceStore(),
      remote,
    }).load(OWNER);

    expect(home?.decisions.map((d) => d.id)).toEqual([lineage]);
    expect(home?.recentSimulations.map((s) => s.decision_id)).toEqual([lineage, lineage]);
    // The earliest version asked the question, so it names the decision.
    expect(home?.decisions[0].created_at).toBe("2026-01-01T00:00:00.000Z");
  });
});
