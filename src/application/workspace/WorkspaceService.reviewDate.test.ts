import { beforeEach, describe, expect, it } from "vitest";
import { LocalWorkspaceStore } from "../../infrastructure/repositories/LocalWorkspaceStore";
import { WorkspaceService } from "./WorkspaceService";

const DAY_MS = 86_400_000;

describe("chooseBestPath — the review date", () => {
  const ownerId = "review-date-user";
  let service: WorkspaceService;

  beforeEach(() => {
    localStorage.clear();
    service = new WorkspaceService({ local: new LocalWorkspaceStore(), remote: null });
  });

  /** Runs the loop up to a collapsed simulation with futures to choose from. */
  async function collapsedRun() {
    await service.createWorkspace(ownerId, "Review Lab", "Outcome loop");
    await service.setGoal(ownerId, "Launch CLAB", "Ship a public launch");
    const home = await service.runSimulation(ownerId, "Should we raise before launch?", []);
    const sim = home.recentSimulations[0]!;
    const future = (home.futuresBySimulation[sim.id] ?? [])[0]!;
    expect(sim.status).toBe("completed");
    expect(future).toBeDefined();
    return { sim, future };
  }

  /** Days between the two instants the save wrote. */
  function gapDays(result: { chosen_at?: string; review_at?: string | null }): number {
    return (new Date(result.review_at!).getTime() - new Date(result.chosen_at!).getTime()) / DAY_MS;
  }

  it("writes a review date derived from the chosen horizon", async () => {
    const { sim, future } = await collapsedRun();
    const home = await service.chooseBestPath(ownerId, sim.id, future.id, "1m");
    const saved = home.recentSimulations.find((s) => s.id === sim.id)!;

    expect(saved.result.chosen_at).toBeTruthy();
    expect(gapDays(saved.result)).toBeCloseTo(30, 5);
  });

  it("defaults to the two-week horizon when none is given", async () => {
    const { sim, future } = await collapsedRun();
    const home = await service.chooseBestPath(ownerId, sim.id, future.id);
    const saved = home.recentSimulations.find((s) => s.id === sim.id)!;

    expect(gapDays(saved.result)).toBeCloseTo(14, 5);
  });

  it("writes null when the user opts out of a review", async () => {
    const { sim, future } = await collapsedRun();
    const home = await service.chooseBestPath(ownerId, sim.id, future.id, "never");
    const saved = home.recentSimulations.find((s) => s.id === sim.id)!;

    // The path is still saved — opting out of the reminder is not opting out
    // of the decision.
    expect(saved.result.review_at).toBeNull();
    expect(saved.result.chosen_at).toBeTruthy();
  });
});
