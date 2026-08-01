import { describe, expect, it } from "vitest";
import { assessObjectiveScope } from "./objectiveScope";

describe("assessObjectiveScope", () => {
  describe("objectives the catalog can actually answer", () => {
    // Every scenario in startup-sim.ts is a go-to-market play, so "in scope"
    // means "a startup/business decision", not "a decision".
    it.each([
      "How should we launch our public beta with a small team?",
      "Should we raise a seed round or bootstrap for another year?",
      "Do we expand into the German market next quarter?",
      "Should I hire two mid engineers or one staff engineer?",
      "Go upmarket to enterprise, or stay self-serve?",
      "Price per seat or usage-based?",
      "Should we pivot the product toward developers?",
    ])("accepts %j", (objective) => {
      expect(assessObjectiveScope(objective).inScope).toBe(true);
    });
  });

  describe("objectives it cannot", () => {
    it.each([
      "I want to cook boiled egg",
      "what should I have for dinner",
      "how do I get my toddler to sleep through the night",
      "plan my holiday to Portugal",
    ])("rejects %j", (objective) => {
      expect(assessObjectiveScope(objective).inScope).toBe(false);
    });

    it("reports which domain terms it looked for, so the UI can be specific", () => {
      const scope = assessObjectiveScope("I want to cook boiled egg");
      expect(scope.inScope).toBe(false);
      expect(scope.matched).toEqual([]);
    });

    it("names the terms it matched when in scope", () => {
      const scope = assessObjectiveScope("Should we raise a seed round?");
      expect(scope.matched).toContain("raise");
    });
  });

  describe("edges", () => {
    it("treats an empty objective as out of scope rather than throwing", () => {
      expect(assessObjectiveScope("").inScope).toBe(false);
      expect(assessObjectiveScope("   ").inScope).toBe(false);
    });

    it("is case-insensitive", () => {
      expect(assessObjectiveScope("SHOULD WE RAISE A SEED ROUND?").inScope).toBe(true);
    });

    it("matches whole words only, so 'team' does not fire on 'steamed'", () => {
      // "steamed broccoli" must not read as a team decision.
      expect(assessObjectiveScope("how long to cook steamed broccoli").inScope).toBe(false);
    });

    it("is deterministic — the engine invariant applies to its gate too", () => {
      const once = assessObjectiveScope("Should we raise a seed round?");
      const twice = assessObjectiveScope("Should we raise a seed round?");
      expect(once).toEqual(twice);
    });
  });
});
