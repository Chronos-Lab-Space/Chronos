import { describe, expect, it } from "vitest";
import {
  archiveGoalIfChanged,
  buildActivityFeed,
  listDecisionHistory,
  listPendingDecisions,
} from "./workspaceMemory";
import type { SimulationRecord, WorkspaceHome } from "./types";

function makeHome(sims: SimulationRecord[] = []): WorkspaceHome {
  return {
    workspace: {
      id: "w1",
      owner_id: "u1",
      name: "Lab",
      description: "",
      created_at: "2026-01-01T00:00:00.000Z",
    },
    goal: {
      id: "g1",
      workspace_id: "w1",
      title: "Launch",
      description: "",
      status: "active",
      priority: 1,
      created_at: "2026-01-01T00:00:00.000Z",
    },
    goalHistory: [],
    recentSimulations: sims,
    knowledge: [
      {
        id: "k1",
        workspace_id: "w1",
        type: "markdown",
        title: "Brief",
        content: "x",
        metadata: {},
        created_at: "2026-01-02T00:00:00.000Z",
      },
    ],
    notes: [],
    futuresBySimulation: {},
    timelineBySimulation: {},
  };
}

const baseSim = (over: Partial<SimulationRecord> = {}): SimulationRecord => ({
  id: "s1",
  workspace_id: "w1",
  goal_id: "g1",
  title: "Raise?",
  status: "completed",
  confidence: 0.8,
  result: {},
  created_at: "2026-01-03T00:00:00.000Z",
  version: 1,
  lineage_id: "L1",
  parent_simulation_id: null,
  ...over,
});

describe("workspaceMemory", () => {
  it("lists pending choose-path and outcome follow-ups", () => {
    const home = makeHome([
      baseSim({ id: "s1", result: {} }),
      baseSim({
        id: "s2",
        created_at: "2026-01-04T00:00:00.000Z",
        result: {
          chosen_future_id: "f1",
          chosen_future_name: "Beta",
          chosen_at: "2026-01-04T01:00:00.000Z",
        },
      }),
    ]);
    const pending = listPendingDecisions(home);
    expect(pending.some((p) => p.reason === "choose_path")).toBe(true);
    expect(pending.some((p) => p.reason === "record_followed")).toBe(true);
  });

  it("builds decision history from saved paths", () => {
    const home = makeHome([
      baseSim({
        result: {
          chosen_future_id: "f1",
          chosen_future_name: "Beta First",
          chosen_at: "2026-01-05T00:00:00.000Z",
          outcome_followed: "yes",
          outcome_result: "Shipped on time",
        },
      }),
    ]);
    const hist = listDecisionHistory(home);
    expect(hist).toHaveLength(1);
    expect(hist[0].pathName).toBe("Beta First");
    expect(hist[0].followed).toBe("yes");
  });

  it("builds activity feed with knowledge and sims", () => {
    const feed = buildActivityFeed(makeHome([baseSim()]), 20);
    expect(feed.some((i) => i.kind === "knowledge")).toBe(true);
    expect(feed.some((i) => i.kind === "simulation")).toBe(true);
    expect(feed.some((i) => i.kind === "goal")).toBe(true);
  });

  it("archives goal when title changes", () => {
    const current = makeHome().goal!;
    const next = archiveGoalIfChanged(current, "New objective", "", []);
    expect(next).toHaveLength(1);
    expect(next[0].title).toBe("Launch");
    expect(next[0].status).toBe("archived");

    const same = archiveGoalIfChanged(current, "Launch", "desc only", []);
    expect(same).toHaveLength(0);
  });
});
