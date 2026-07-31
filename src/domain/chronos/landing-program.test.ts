import { describe, expect, it } from "vitest";
import { LANDING_PROGRAM } from "./landing-program";
import { compile } from "./language";

describe("LANDING_PROGRAM", () => {
  // The landing page presents this as a .chronos file under copy calling
  // Chronos Language an authoring layer. The previous snippet was invented
  // syntax that did not survive the tokenizer. Whatever the page shows has to
  // be a program this compiler accepts.
  it("compiles with the real Chronos Language compiler", () => {
    expect(() => compile(LANDING_PROGRAM)).not.toThrow();
  });

  it("declares the actions, score, and run block the page claims it does", () => {
    const compiled = compile(LANDING_PROGRAM);

    // A program that parsed but produced no alternatives would still "compile"
    // while demonstrating nothing — the page's claim is that Chronos forks a
    // decision into scored branches.
    expect(compiled.actions.length).toBeGreaterThanOrEqual(2);
    expect(compiled.run?.fork).toBe(true);
    expect(compiled.run?.collapse).toBe("max-utility");

    const scoreName = compiled.run?.evaluate;
    expect(scoreName).toBeTruthy();
    const score = compiled.scoreFns[scoreName as string];
    expect(typeof score).toBe("function");
  });

  it("scores every declared action without reading an undeclared field", () => {
    const compiled = compile(LANDING_PROGRAM);
    const score = compiled.scoreFns[compiled.run?.evaluate as string];

    // The score body is evaluated against the program's own namespaces, so the
    // state is spelled out here rather than taken from `compiled.initialState`
    // (which compile() maps onto a fixed robot/object/environment shape).
    // Reading a field the state block never declares throws "field not found",
    // which is the mistake this guards — a sample that parses but cannot run.
    const declared = {
      agent: { runway: 18, mrr: 40, momentum: 55, optionality: "open" },
      world: { market: "shifting", positioned: false },
      context: { board: "watching", competitive_wind: 6 },
    };

    for (const action of compiled.actions) {
      const value = score({ ...declared, risk: action.baseRisk, reward: action.baseReward });
      expect(Number.isFinite(value)).toBe(true);
    }
  });
});
