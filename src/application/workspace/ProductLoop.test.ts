/**
 * Product validation loop:
 * Create Workspace → Set Goal → Add Context → Run Simulation
 * → Compare Futures → Choose Best Path → Save
 *
 * If this feels useful, the product is validated.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { LocalWorkspaceStore } from "../../infrastructure/repositories/LocalWorkspaceStore";
import { WorkspaceService } from "./WorkspaceService";

describe("Product validation loop", () => {
  const ownerId = "product-loop-user";
  let service: WorkspaceService;

  beforeEach(() => {
    localStorage.clear();
    service = new WorkspaceService({
      local: new LocalWorkspaceStore(),
      remote: null,
    });
  });

  it("runs Create → Goal → Context → Simulate → Compare → Choose → Save", async () => {
    // 1. Create Workspace
    let home = await service.createWorkspace(ownerId, "Product Lab", "Validation HQ");
    expect(home.workspace.name).toBe("Product Lab");
    expect(home.goal).toBeNull();
    expect(home.recentSimulations).toHaveLength(0);

    // 2. Set Goal
    home = await service.setGoal(
      ownerId,
      "Launch CLAB on Kickstart",
      "Ship a public launch with a clear best path"
    );
    expect(home.goal?.title).toBe("Launch CLAB on Kickstart");
    expect(home.goal?.status).toBe("active");

    // 3. Add Context
    home = await service.addKnowledge(ownerId, {
      type: "markdown",
      title: "Kickstart brief.md",
      content: "Bootstrap preferred. 12-month runway. Early backers matter.",
    });
    home = await service.addKnowledge(ownerId, {
      type: "url",
      title: "https://chronoslab.space",
      metadata: { url: "https://chronoslab.space" },
    });
    home = await service.addNote(ownerId, "Constraints", "No raise before launch");
    expect(home.knowledge.length).toBeGreaterThanOrEqual(2);
    expect(home.notes.length).toBeGreaterThanOrEqual(1);

    // 4. Run Simulation
    home = await service.runSimulation(
      ownerId,
      "Should we raise funding before Kickstart?",
      ["no raise before launch", "keep runway 12 months"]
    );
    const sim = home.recentSimulations[0];
    expect(sim.status).toBe("completed");
    expect(sim.result.futures_count).toBe(5);
    expect(sim.result.recommendation).toBeTruthy();
    expect(sim.result.best_future).toBeTruthy();
    expect(Array.isArray(sim.result.knowledge_used)).toBe(true);
    expect((sim.result.knowledge_used as unknown[]).length).toBeGreaterThan(0);
    expect(sim.result.goal_title).toBe("Launch CLAB on Kickstart");

    // 5. Compare Futures
    const futures = home.futuresBySimulation[sim.id] ?? [];
    expect(futures.length).toBe(5);
    // Ranked descending score (engine contract)
    for (let i = 1; i < futures.length; i++) {
      expect(futures[i - 1].score).toBeGreaterThanOrEqual(futures[i].score);
    }
    const engineBest = futures[0];
    const alternate = futures[1] ?? futures[0];
    expect(engineBest.name).toBeTruthy();
    expect(alternate.summary).toBeTruthy();

    // 6. Choose Best Path (user may pick engine best or an alternate)
    const chosen = alternate;
    home = await service.chooseBestPath(ownerId, sim.id, chosen.id);
    const saved = home.recentSimulations.find((s) => s.id === sim.id)!;
    expect(saved.result.chosen_future_id).toBe(chosen.id);
    expect(saved.result.chosen_future_name).toBe(chosen.name);
    expect(saved.result.chosen_at).toBeTruthy();
    expect(saved.result.best_future).toBe(chosen.name);

    // Decision note logged
    expect(home.notes.some((n) => n.title.includes(chosen.name))).toBe(true);

    // 7. Save (persist + resume)
    const resumed = await new WorkspaceService({
      local: new LocalWorkspaceStore(),
      remote: null,
    }).load(ownerId);

    expect(resumed).not.toBeNull();
    expect(resumed!.workspace.name).toBe("Product Lab");
    expect(resumed!.goal?.title).toBe("Launch CLAB on Kickstart");
    expect(resumed!.knowledge.length).toBeGreaterThanOrEqual(2);
    const resumedSim = resumed!.recentSimulations.find((s) => s.id === sim.id)!;
    expect(resumedSim.result.chosen_future_id).toBe(chosen.id);
    expect(resumed!.futuresBySimulation[sim.id]).toHaveLength(5);

    // Product validated: cumulative decision, not a blank slate
    expect(resumed!.notes.length).toBeGreaterThanOrEqual(2);
  });
});
