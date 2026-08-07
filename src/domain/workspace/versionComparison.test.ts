import { describe, expect, it } from "vitest";
import { compareVersions } from "./versionComparison";
import type { SimulationRecord } from "./types";

function sim(over: Partial<SimulationRecord> & Pick<SimulationRecord, "id">): SimulationRecord {
  return {
    workspace_id: "w1",
    goal_id: null,
    title: "How should we launch?",
    status: "completed",
    confidence: 0.72,
    result: {},
    created_at: "2026-07-24T00:00:00.000Z",
    version: 1,
    lineage_id: over.id,
    parent_simulation_id: null,
    ...over,
  };
}

describe("compareVersions", () => {
  it("pairs each field across both versions", () => {
    const a = sim({
      id: "s1",
      version: 1,
      confidence: 0.6,
      result: { recommendation: "Bootstrap", chosen_future_name: "Bootstrap", risks: ["a", "b"] },
    });
    const b = sim({
      id: "s2",
      version: 2,
      confidence: 0.8,
      result: { recommendation: "Raise", chosen_future_name: "Raise", risks: ["a"] },
    });

    const rows = compareVersions(a, b);
    const byLabel = Object.fromEntries(rows.map((r) => [r.label, r]));

    expect(byLabel.Version).toEqual({ label: "Version", a: "v1", b: "v2" });
    expect(byLabel.Confidence).toEqual({ label: "Confidence", a: "60%", b: "80%" });
    expect(byLabel["Chosen path"]).toEqual({ label: "Chosen path", a: "Bootstrap", b: "Raise" });
    expect(byLabel.Recommendation).toEqual({ label: "Recommendation", a: "Bootstrap", b: "Raise" });
    expect(byLabel.Risks).toEqual({ label: "Risks", a: "2", b: "1" });
  });

  it("shows a placeholder for missing fields rather than blank cells", () => {
    const a = sim({ id: "s1", confidence: null, result: {} });
    const b = sim({ id: "s2", result: {} });

    const rows = compareVersions(a, b);
    const byLabel = Object.fromEntries(rows.map((r) => [r.label, r]));

    expect(byLabel.Confidence?.a).toBe("—");
    expect(byLabel["Chosen path"]?.a).toBe("—");
  });
});
