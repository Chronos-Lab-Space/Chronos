import { describe, expect, it } from "vitest";
import { evaluateBetaChecklist } from "./betaChecklist";
import { isSampleSimulation, SAMPLE_OBJECTIVE, withoutSampleSimulations } from "./sampleDecision";
import type { SimulationRecord, WorkspaceHome } from "./types";

function sim(over: Partial<SimulationRecord> = {}): SimulationRecord {
  return {
    id: "s1",
    workspace_id: "w1",
    goal_id: null,
    title: "Real decision",
    status: "completed",
    confidence: 0.8,
    result: {},
    created_at: "2026-07-20T00:00:00.000Z",
    version: 1,
    lineage_id: "s1",
    parent_simulation_id: null,
    ...over,
  };
}

const sample = sim({
  id: "sample-1",
  title: SAMPLE_OBJECTIVE,
  result: { is_sample: true, chosen_future_id: "f1", chosen_future_name: "Invite-only" },
});

function home(sims: SimulationRecord[]): WorkspaceHome {
  return {
    workspace: { id: "w1", owner_id: "o1", name: "Lab", description: "", created_at: "" },
    goal: { id: "g1", title: "Something", description: "", status: "active", created_at: "" },
    goalHistory: [],
    knowledge: [],
    notes: [],
    recentSimulations: sims,
    futuresBySimulation: {},
    timelineBySimulation: {},
  } as unknown as WorkspaceHome;
}

describe("sampleDecision", () => {
  it("identifies sample records by an explicit flag, not by title", () => {
    expect(isSampleSimulation(sample)).toBe(true);
    // A real run that happens to reuse the sample's objective is not a sample.
    expect(isSampleSimulation(sim({ title: SAMPLE_OBJECTIVE }))).toBe(false);
    expect(isSampleSimulation(sim())).toBe(false);
  });

  it("filters samples out of a list", () => {
    const kept = withoutSampleSimulations([sample, sim()]);
    expect(kept).toHaveLength(1);
    expect(kept[0]?.id).toBe("s1");
  });

  it("does not let a sample complete the beta checklist", () => {
    // The sample is a demo of the loop, not evidence the user ran it. Counting
    // it would tell a new user they had finished onboarding they never did.
    const items = evaluateBetaChecklist(home([sample]));
    const byId = Object.fromEntries(items.map((i) => [i.id, i.done]));

    expect(byId.simulation).toBe(false);
    expect(byId.memory).toBe(false);
  });

  it("still credits a real run alongside a sample", () => {
    const real = sim({ result: { chosen_future_id: "f9" } });
    const items = evaluateBetaChecklist(home([sample, real]));
    const byId = Object.fromEntries(items.map((i) => [i.id, i.done]));

    expect(byId.simulation).toBe(true);
    expect(byId.memory).toBe(true);
  });
});
