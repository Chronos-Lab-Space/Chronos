import { describe, expect, it } from "vitest";
import type { SimulationRecord } from "../../domain/workspace/types";
import { orderSimulationsForUpsert } from "./SupabaseWorkspaceRepository";

function sim(id: string, parent: string | null, created_at: string): SimulationRecord {
  return {
    id,
    workspace_id: "w",
    goal_id: null,
    title: id,
    status: "completed",
    confidence: 1,
    result: {},
    created_at,
    version: parent ? 2 : 1,
    lineage_id: "L",
    parent_simulation_id: parent,
  };
}

describe("orderSimulationsForUpsert", () => {
  it("emits parents before children for FK-safe bulk upsert", () => {
    const child = sim("c", "p", "2026-07-02T00:00:00.000Z");
    const parent = sim("p", null, "2026-07-01T00:00:00.000Z");
    const grand = sim("g", "c", "2026-07-03T00:00:00.000Z");
    // Deliberately reverse input order
    const ordered = orderSimulationsForUpsert([grand, child, parent]);
    expect(ordered.map((s) => s.id)).toEqual(["p", "c", "g"]);
  });
});
