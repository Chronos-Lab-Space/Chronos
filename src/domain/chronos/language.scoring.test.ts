import { describe, expect, it } from "vitest";
import { createEngine, evaluate, fork } from "../../application/chronos/engine";
import { compile, toAuthoredState } from "./language";

/**
 * A `score` block decides the branch scores the playground shows.
 *
 * It used to be parsed, exposed on `scoreFns`, and ignored: `evaluate()` scored
 * every branch with the built-in reward/risk model, because `compile()` flattens
 * the program's agent/world/context namespaces onto a fixed WorldState and the
 * score body's fields were gone by the time the engine held the state.
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
  base = state.reward * 0 + 0.777
  return base
}

run {
  fork
  evaluate with utility
  collapse max-utility
}
`;

function scoredWith(source: string, useAuthored: boolean) {
  const compiled = compile(source);
  const engine = fork(createEngine("custom", compiled.initialState, compiled.actions));
  const score = compiled.scoreFns[compiled.run?.evaluate ?? ""];
  const scorer = useAuthored
    ? (branch: { state: typeof compiled.initialState; risk: number; reward: number }) =>
        score({ ...toAuthoredState(branch.state), risk: branch.risk, reward: branch.reward })
    : undefined;
  return evaluate(engine, scorer).branches.map((b) => b.outcome?.score);
}

describe("authored score functions", () => {
  it("drive the branch scores when the program declares one", () => {
    const scores = scoredWith(PROGRAM, true);

    expect(scores.length).toBeGreaterThan(0);
    for (const score of scores) {
      expect(score).toBeCloseTo(0.777, 3);
    }
  });

  it("leave the built-in scorer in charge when no scorer is passed", () => {
    // The product path calls evaluate() with one argument. Authored scoring is
    // opt-in from the playground, so a change here cannot move product ranking.
    const scores = scoredWith(PROGRAM, false);

    for (const score of scores) {
      expect(score).not.toBeCloseTo(0.777, 3);
    }
  });

  it("hands the score body the namespaces the program declared", () => {
    const compiled = compile(PROGRAM);
    const authored = toAuthoredState(compiled.initialState);

    // The blocker this replaced: calling a compiled scoreFn with engine state
    // threw "field 'agent' not found".
    expect(authored.agent).toBeDefined();
    expect(authored.world).toBeDefined();
    expect(authored.context).toBeDefined();
    expect(() => compiled.scoreFns.utility({ ...authored, risk: 0.5, reward: 0.9 })).not.toThrow();
  });
});
