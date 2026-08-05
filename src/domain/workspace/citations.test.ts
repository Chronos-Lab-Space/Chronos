import { describe, expect, it } from "vitest";
import { countCitations } from "./citations";
import type { SimulationRecord } from "./types";

function sim(over: Partial<SimulationRecord> & Pick<SimulationRecord, "id">): SimulationRecord {
  return {
    workspace_id: "w1",
    goal_id: null,
    title: "Run",
    status: "completed",
    confidence: 0.7,
    result: {},
    created_at: "2026-07-20T00:00:00.000Z",
    version: 1,
    lineage_id: over.id,
    parent_simulation_id: null,
    ...over,
  };
}

function used(...ids: string[]) {
  return { knowledge_used: ids.map((id) => ({ id, title: id, type: "document" })) };
}

describe("countCitations", () => {
  it("counts the runs that leaned on each source", () => {
    const counts = countCitations([
      sim({ id: "s1", result: used("k1", "k2") }),
      sim({ id: "s2", result: used("k1") }),
    ]);

    expect(counts.get("k1")).toBe(2);
    expect(counts.get("k2")).toBe(1);
  });

  it("has no count for a source no run has used", () => {
    const counts = countCitations([sim({ id: "s1", result: used("k1") })]);

    expect(counts.get("k9")).toBeUndefined();
  });

  it("counts a source once per run even when the run lists it twice", () => {
    const counts = countCitations([sim({ id: "s1", result: used("k1", "k1") })]);

    expect(counts.get("k1")).toBe(1);
  });

  it("ignores runs from before the field existed rather than assuming every source was used", () => {
    // resolveKnowledgeUsed falls back to a snapshot of the whole library for
    // legacy runs. Counting that fallback would report every source as cited
    // by every run — a number the workspace never actually recorded.
    const counts = countCitations([sim({ id: "s-legacy", result: { best_future: "A" } })]);

    expect(counts.size).toBe(0);
  });

  it("does not count runs that never completed", () => {
    const counts = countCitations([
      sim({ id: "s1", status: "running", result: used("k1") }),
      sim({ id: "s2", status: "failed", result: used("k1") }),
    ]);

    expect(counts.size).toBe(0);
  });
});
