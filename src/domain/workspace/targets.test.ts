import { describe, expect, it } from "vitest";
import { deriveTargets } from "./targets";
import type { GoalRecord } from "./types";

function goal(title: string, description = ""): GoalRecord {
  return {
    id: "g1",
    workspace_id: "w1",
    title,
    description,
    status: "active",
    priority: 1,
    created_at: "2026-01-02T00:00:00.000Z",
  };
}

describe("deriveTargets", () => {
  it("echoes measurable phrases from the objective", () => {
    const targets = deriveTargets(
      goal("Launch the beta", "Reach 1,000 signups at 40% retention within 90 days")
    );

    expect(targets).toEqual([
      { value: "1,000", label: "signups" },
      { value: "40%", label: "retention" },
      { value: "90", label: "days" },
    ]);
  });

  it("finds nothing when the objective names no quantities", () => {
    expect(deriveTargets(goal("Launch a beta that earns durable adoption"))).toEqual([]);
  });

  it("ignores a bare number with no unit word after it", () => {
    expect(deriveTargets(goal("Ship v2", "Decide by 2026."))).toEqual([]);
  });

  it("treats a date as a deadline, not a target", () => {
    expect(deriveTargets(goal("Open the beta", "Launch on 12 Aug with 300 users"))).toEqual([
      { value: "300", label: "users" },
    ]);
  });

  it("keeps each measure once", () => {
    expect(
      deriveTargets(goal("Growth", "300 users this month, then 300 users the month after"))
    ).toEqual([{ value: "300", label: "users" }]);
  });

  it("caps the list so the rail stays readable", () => {
    const targets = deriveTargets(
      goal("Everything", "1 a, 2 b, 3 c, 4 d, 5 e, 6 f — every one of these is measurable")
    );

    expect(targets).toHaveLength(4);
  });

  it("has no targets without a goal", () => {
    expect(deriveTargets(null)).toEqual([]);
  });
});
