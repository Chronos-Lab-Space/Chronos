import { describe, expect, it } from "vitest";
import { deriveExpectedValue } from "./expectedValue";
import type { FutureRecord, SimulationRecord } from "./types";

const sim: SimulationRecord = {
  id: "s1",
  workspace_id: "w1",
  goal_id: "g1",
  title: "Launch",
  status: "completed",
  confidence: 0.88,
  result: {},
  created_at: "2026-01-01T00:00:00.000Z",
  version: 1,
  lineage_id: "s1",
  parent_simulation_id: null,
};

const lowRisk: FutureRecord = {
  id: "f1",
  simulation_id: "s1",
  name: "Private Beta First",
  score: 0.9,
  risk: 0.2,
  confidence: 0.91,
  summary: "Bootstrap MVP and validate incrementally",
};

const highRisk: FutureRecord = {
  id: "f2",
  simulation_id: "s1",
  name: "Raise and scale",
  score: 0.6,
  risk: 0.7,
  confidence: 0.5,
  summary: "Aggressive fundraise and enterprise blitz",
};

describe("deriveExpectedValue", () => {
  it("emits risk, confidence, and omits nothing critical for lean path", () => {
    const r = deriveExpectedValue({
      chosen: lowRisk,
      futures: [lowRisk, highRisk],
      simulation: sim,
      knowledgeCount: 2,
      constraintCount: 2,
    });
    expect(r.rows.some((row) => row.id === "risk")).toBe(true);
    expect(r.rows.some((row) => row.id === "confidence")).toBe(true);
    expect(r.rows.find((row) => row.id === "confidence")?.value).toBe("91%");
    expect(r.rows.some((row) => row.id === "knowledge")).toBe(true);
    expect(r.reason).toBeTruthy();
  });

  it("omits knowledge row when count is zero", () => {
    const r = deriveExpectedValue({
      chosen: lowRisk,
      futures: [lowRisk],
      simulation: sim,
      knowledgeCount: 0,
      constraintCount: 0,
    });
    expect(r.rows.some((row) => row.id === "knowledge")).toBe(false);
  });
});
