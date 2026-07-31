import { describe, expect, it } from "vitest";
import { createEngine, evaluate, fork } from "../../application/chronos/engine";
import { compile } from "./language";

/**
 * What a `score` block currently does, stated plainly so the playground copy
 * can be trusted.
 *
 * The compiler parses the block and exposes it on `scoreFns`. Nothing calls it:
 * `evaluate()` scores every branch with the engine's built-in reward/risk
 * scorer. These assertions fail the moment authored scoring is wired up, which
 * is the point — the UI text has to change in the same commit.
 */
const PROGRAM = `# Chronos Language v0.1

state {
  agent.runway = 18
  world.market = "shifting"
  context.board = "watching"
}

action "Alpha" {
  agent.runway = 11
  risk = 0.5
  reward = 0.9
}

action "Beta" {
  agent.runway = 14
  risk = 0.2
  reward = 0.4
}

score utility(state) {
  base = state.agent.runway * 0
  return base + 0.777
}

run {
  fork
  evaluate with utility
  collapse max-utility
}
`;

describe("authored score functions", () => {
  it("are compiled and exposed", () => {
    const compiled = compile(PROGRAM);

    expect(typeof compiled.scoreFns.utility).toBe("function");
    expect(compiled.run?.evaluate).toBe("utility");
  });

  it("do not produce the branch scores the playground displays", () => {
    const compiled = compile(PROGRAM);
    const engine = evaluate(fork(createEngine("custom", compiled.initialState, compiled.actions)));

    const scores = engine.branches
      .map((b) => b.outcome?.score)
      .filter((s) => typeof s === "number");
    expect(scores.length).toBeGreaterThan(0);

    // The authored function returns a constant. If it were driving evaluation
    // every branch would read 0.777.
    for (const score of scores) {
      expect(score).not.toBeCloseTo(0.777, 3);
    }
  });

  it("cannot be called with the state the engine carries", () => {
    const compiled = compile(PROGRAM);
    const score = compiled.scoreFns.utility;

    // compile() maps agent/world/context onto a fixed robot/object/environment
    // WorldState, so the namespaces the score body reads are gone by the time
    // the engine holds the state. This is the blocker for wiring it up.
    expect(() => score(compiled.initialState)).toThrow();
  });
});
