import { describe, expect, it } from "vitest";
import { collapse, createEngine, evaluate, fork } from "../../application/chronos/engine";
import { presetPrograms, compile } from "./language";
import { simulate } from "./startup-sim";

describe("Chronos simulation integration", () => {
  it("compiles a Chronos program into an executable simulation and completes the full lifecycle", () => {
    const compiled = compile(presetPrograms.forge.source);
    const simulation = createEngine("forge-language", compiled.initialState, compiled.actions);
    const result = collapse(evaluate(fork(simulation)), "max-utility");

    expect(compiled.actions.map((action) => action.name)).toEqual([
      "Ship as-is",
      "Refactor first",
      "Write tests first",
      "Defer to next sprint",
    ]);
    expect(compiled.run).toEqual({
      fork: true,
      evaluate: "utility",
      collapse: "max-utility",
    });
    expect(result.status).toBe("completed");
    expect(result.winner).not.toBeNull();
    expect(result.timeline.events.map((event) => event.phase)).toEqual([
      "idle",
      "forked",
      "evaluated",
      "collapsed",
    ]);
  });

  it("returns deterministic startup futures for a given idea and collapses to a viable best path", () => {
    const idea = "I want to build an AI meeting assistant";
    const first = simulate(idea);
    const second = simulate(idea);

    expect(second).toEqual(first);
    expect(first.category).toBe("productivity");
    // Honest counts: archetypes in catalog, samples actually scored
    expect(first.totalPaths).toBeGreaterThanOrEqual(1);
    expect(first.totalPaths).toBeLessThanOrEqual(8);
    expect(first.pathsEvaluated).toBeGreaterThanOrEqual(8);
    expect(first.pathsEvaluated).toBeLessThanOrEqual(256);
    expect(first.bestExpectedValue).toBeGreaterThan(0);
    expect(first.bestPath.probability).toBeGreaterThan(0);
    expect(first.bestPath.arr).toBeGreaterThan(0);
    expect(first.bestPath.milestones.map((milestone) => milestone.month)).toEqual([
      1, 3, 6, 9, 12, 18,
    ]);
    expect(first.alternatives.length).toBeGreaterThan(0);
  });

  it("scales sample budget and remains deterministic", () => {
    const idea = "fintech payments for freelancers";
    const small = simulate(idea, { sampleBudget: 16 });
    const large = simulate(idea, { sampleBudget: 128 });
    expect(small.pathsEvaluated).toBeLessThan(large.pathsEvaluated);
    expect(simulate(idea, { sampleBudget: 16 })).toEqual(small);
  });
});
