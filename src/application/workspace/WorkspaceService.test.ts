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
    service = new WorkspaceService(store);
  });

  it("lets a user create a workspace, set a goal, add context, run a sim, and resume", () => {
    expect(service.load(ownerId)).toBeNull();

    let home = service.createWorkspace(ownerId, "Chronos Lab");
    expect(home.workspace.name).toBe("Chronos Lab");
    expect(home.goal).toBeNull();
    expect(home.recentSimulations).toEqual([]);

    home = service.setGoal(ownerId, "Launch CLAB on Kickstart", "Public launch path");
    expect(home.goal?.title).toBe("Launch CLAB on Kickstart");
    expect(home.goal?.status).toBe("active");

    home = service.addKnowledge(ownerId, {
      type: "pdf",
      title: "Kickstart brief.pdf",
      content: "outline",
    });
    home = service.addKnowledge(ownerId, {
      type: "website",
      title: "https://chronoslab.space",
      metadata: { url: "https://chronoslab.space" },
    });
    home = service.addNote(ownerId, "Launch constraints", "Ship demo + waitlist");
    expect(home.knowledge).toHaveLength(2);
    expect(home.notes).toHaveLength(1);

    home = service.runSimulation(ownerId, "Should we raise funding before Kickstart?");
    expect(home.recentSimulations).toHaveLength(1);
    expect(home.recentSimulations[0].status).toBe("completed");
    expect(home.recentSimulations[0].title).toContain("funding");
    expect(home.recentSimulations[0].futures_count).toBeGreaterThan(0);
    expect(home.recentSimulations[0].best_outcome).toBeTruthy();
    expect(home.recentSimulations[0].confidence).toBeGreaterThan(0);

    // Return later: new service instance, same store → full HQ restored
    const resumed = new WorkspaceService(store).load(ownerId);
    expect(resumed).not.toBeNull();
    expect(resumed?.workspace.name).toBe("Chronos Lab");
    expect(resumed?.goal?.title).toBe("Launch CLAB on Kickstart");
    expect(resumed?.knowledge).toHaveLength(2);
    expect(resumed?.notes).toHaveLength(1);
    expect(resumed?.recentSimulations).toHaveLength(1);
    expect(resumed?.recentSimulations[0].id).toBe(home.recentSimulations[0].id);
  });

  it("rejects empty names and requires a workspace before mutations", () => {
    expect(() => service.createWorkspace(ownerId, "   ")).toThrow(/name/i);
    expect(() => service.setGoal(ownerId, "A goal")).toThrow(/workspace/i);

    service.createWorkspace(ownerId, "Lab");
    expect(() => service.setGoal(ownerId, "  ")).toThrow(/goal/i);
    expect(() => service.runSimulation(ownerId, "")).toThrow(/objective/i);
  });
});
