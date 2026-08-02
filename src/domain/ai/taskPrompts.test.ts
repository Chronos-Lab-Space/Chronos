import { describe, expect, it } from "vitest";
import { buildTaskMessages, isAITaskKind } from "./taskPrompts";

describe("buildTaskMessages", () => {
  it("builds sim.recommendation from fields", () => {
    const built = buildTaskMessages({
      task: "sim.recommendation",
      fields: {
        objective: "Launch beta",
        pathName: "Invite-only",
        pathSummary: "50 users",
      },
    });
    expect(built.prompt).toContain("Launch beta");
    expect(built.prompt).toContain("Invite-only");
    expect(built.system).toMatch(/decision briefs/i);
  });

  it("rejects incomplete sim.recommendation", () => {
    expect(() =>
      buildTaskMessages({ task: "sim.recommendation", fields: { objective: "x" } })
    ).toThrow(/pathName/);
  });

  it("includes researchContext on plan.steps", () => {
    const built = buildTaskMessages({
      task: "plan.steps",
      fields: { objective: "Ship", researchContext: "Competitor X raised" },
    });
    expect(built.prompt).toContain("Competitor X raised");
  });

  it("recognizes allowlisted task kinds", () => {
    expect(isAITaskKind("plan.steps")).toBe(true);
    expect(isAITaskKind("nope")).toBe(false);
  });
});
