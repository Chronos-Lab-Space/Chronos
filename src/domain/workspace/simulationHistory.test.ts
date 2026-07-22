import { describe, expect, it } from "vitest";
import { groupSimulationsByHistory, historyBucketFor } from "./simulationHistory";
import type { SimulationRecord } from "./types";

function sim(id: string, created_at: string): SimulationRecord {
  return {
    id,
    workspace_id: "w1",
    goal_id: null,
    title: id,
    status: "completed",
    confidence: 0.5,
    result: {},
    created_at,
    version: 1,
    lineage_id: id,
    parent_simulation_id: null,
  };
}

describe("simulationHistory", () => {
  const now = new Date("2026-07-22T15:00:00.000Z");

  it("buckets relative to local day anchors", () => {
    // Use noon UTC so local-day edges are stable in CI
    expect(historyBucketFor("2026-07-22T12:00:00.000Z", now)).toBe("today");
    expect(historyBucketFor("2026-07-21T12:00:00.000Z", now)).toBe("yesterday");
    expect(historyBucketFor("2026-07-18T12:00:00.000Z", now)).toBe("last_week");
    expect(historyBucketFor("2026-06-01T12:00:00.000Z", now)).toBe("earlier");
  });

  it("groups and omits empty buckets", () => {
    const groups = groupSimulationsByHistory(
      [
        sim("a", "2026-07-22T10:00:00.000Z"),
        sim("b", "2026-07-21T10:00:00.000Z"),
        sim("c", "2026-06-01T10:00:00.000Z"),
      ],
      now
    );
    expect(groups.map((g) => g.id)).toEqual(["today", "yesterday", "earlier"]);
    expect(groups[0].simulations[0].id).toBe("a");
  });
});
