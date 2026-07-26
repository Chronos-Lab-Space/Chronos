import { describe, expect, it } from "vitest";
import { getAgent } from "../../domain/chronos/agents";
import { getScenario } from "../../domain/chronos/scenarios";
import {
  collapse,
  createEngine,
  evaluate,
  fork,
  reset,
  run,
  scoreBranch,
  selectWinner,
} from "./engine";
import { Branch, Hypothesis, Outcome } from "../../domain/chronos/entities";
import type { Action, WorldState } from "../../domain/chronos/types";

function robotArmSimulation() {
  const scenario = getScenario("robot-arm");
  return createEngine(scenario.id, scenario.initialState, scenario.actions);
}

describe("Temporal Decision Engine", () => {
  it("forks one isolated branch for each candidate action without mutating the source simulation", () => {
    const simulation = robotArmSimulation();
    const forked = fork(simulation);

    expect(simulation.branches).toHaveLength(0);
    expect(forked.phase).toBe("forked");
    expect(forked.status).toBe("running");
    expect(forked.branches).toHaveLength(simulation.actions.length);
    expect(forked.branches.map((branch) => branch.actionId)).toEqual(
      simulation.actions.map((action) => action.id)
    );
    expect(new Set(forked.branches.map((branch) => branch.id)).size).toBe(
      simulation.actions.length
    );
    expect(forked.branches[0].state).not.toBe(forked.branches[1].state);
    expect(forked.timeline.events[forked.timeline.events.length - 1]?.phase).toBe("forked");
  });

  it("evaluates every branch and records a bounded, explainable outcome", () => {
    const evaluated = evaluate(fork(robotArmSimulation()));

    expect(evaluated.phase).toBe("evaluated");
    expect(evaluated.branches).toHaveLength(4);

    for (const branch of evaluated.branches) {
      expect(branch.status).toBe("evaluated");
      expect(branch.outcome).not.toBeNull();
      expect(branch.score!).toBeGreaterThanOrEqual(0);
      expect(branch.score!).toBeLessThanOrEqual(1);
      expect(branch.reason).toEqual(expect.any(String));
    }

    const directGrasp = evaluated.branches.find((branch) => branch.actionId === "grasp-direct");
    expect(directGrasp).toBeDefined();
    expect(directGrasp!.score).toBeCloseTo(0.82, 5);
    expect(directGrasp!.reason).toContain("grasped");
  });

  it("collapses the max-utility path, commits it to the timeline, and prunes the alternatives", () => {
    const collapsed = collapse(evaluate(fork(robotArmSimulation())), "max-utility");

    expect(collapsed.phase).toBe("collapsed");
    expect(collapsed.status).toBe("completed");
    expect(collapsed.winner?.actionId).toBe("grasp-direct");
    expect(collapsed.winner?.status).toBe("winner");
    expect(collapsed.branches.filter((branch) => branch.status === "pruned")).toHaveLength(3);
    expect(collapsed.timeline.committedBranchId).toBe(collapsed.winner?.id);
    expect(collapsed.timeline.canonicalState).toEqual(collapsed.winner?.state);
    expect(collapsed.log[collapsed.log.length - 1]?.message).toContain("collapse");
  });

  it("uses the configured collapse strategy instead of always choosing maximum utility", () => {
    const collapsed = collapse(evaluate(fork(robotArmSimulation())), "min-risk");

    expect(collapsed.winner?.actionId).toBe("retreat");
    expect(collapsed.winner?.risk).toBeCloseTo(0.02, 5);
  });

  it("balanced collapse honors the evaluated score, not just raw reward", () => {
    const world: WorldState = {
      robot: { x: 0, y: 0, armAngle: 0, gripOpen: false },
      object: { x: 0, y: 0, stable: true, grasped: false },
      environment: { humanPresent: false, wind: 0, lighting: "bright" },
      timestamp: 0,
    };
    const mk = (id: string, score: number, reward: number, risk: number) => {
      const action: Action = {
        id,
        name: id,
        description: "",
        apply: () => ({}),
        baseRisk: risk,
        baseReward: reward,
      };
      return new Branch({
        id: `b-${id}`,
        hypothesis: Hypothesis.fromAction(action),
        state: world,
        status: "evaluated",
        outcome: new Outcome({ branchId: `b-${id}`, score, reward, risk, reason: id }),
      });
    };
    // "shiny" has the highest raw reward but a poor evaluated score;
    // "solid" is the balanced winner once score is considered.
    const shiny = mk("shiny", 0.2, 0.95, 0.1);
    const solid = mk("solid", 0.8, 0.6, 0.2);
    expect(selectWinner([shiny, solid], "balanced").actionId).toBe("solid");
  });

  it("collapse strategies are deterministic under score ties", () => {
    const world: WorldState = {
      robot: { x: 0, y: 0, armAngle: 0, gripOpen: false },
      object: { x: 0, y: 0, stable: true, grasped: false },
      environment: { humanPresent: false, wind: 0, lighting: "bright" },
      timestamp: 0,
    };
    const mk = (id: string, score: number, reward: number, risk: number) => {
      const action: Action = {
        id,
        name: id,
        description: "",
        apply: () => ({}),
        baseRisk: risk,
        baseReward: reward,
      };
      return new Branch({
        id: `b-${id}`,
        hypothesis: Hypothesis.fromAction(action),
        state: world,
        status: "evaluated",
        outcome: new Outcome({ branchId: `b-${id}`, score, reward, risk, reason: id }),
      });
    };
    // identical metrics → the winner must be stable regardless of input order
    const a = mk("alpha", 0.5, 0.5, 0.3);
    const b = mk("bravo", 0.5, 0.5, 0.3);
    for (const strategy of ["min-risk", "balanced"] as const) {
      const w1 = selectWinner([a, b], strategy).actionId;
      const w2 = selectWinner([b, a], strategy).actionId;
      expect(w1, strategy).toBe(w2);
    }
  });

  it("enforces phase transitions and can reset to a new canonical state", () => {
    const simulation = robotArmSimulation();
    expect(evaluate(simulation)).toBe(simulation);
    expect(collapse(simulation)).toBe(simulation);

    const completed = collapse(evaluate(fork(simulation)));
    const resetSimulation = reset(completed, simulation.world);

    expect(resetSimulation.phase).toBe("idle");
    expect(resetSimulation.status).toBe("pending");
    expect(resetSimulation.branches).toHaveLength(0);
    expect(resetSimulation.world).toEqual(simulation.world);
    expect(resetSimulation.timeline.committedBranchId).toBeUndefined();
  });

  it("run() advances idle → collapsed in one call", () => {
    const completed = run(robotArmSimulation(), "max-utility");
    expect(completed.phase).toBe("collapsed");
    expect(completed.winner?.actionId).toBe("grasp-direct");
  });

  it("scores agent domains differently from physical utility", () => {
    const forge = getAgent("forge");
    const engine = createEngine(
      forge.scenario.id,
      forge.scenario.initialState,
      forge.scenario.actions
    );
    const evaluated = evaluate(fork(engine));
    const ship = evaluated.branches.find((b) => b.actionId === "ship-as-is")!;
    const tests = evaluated.branches.find((b) => b.actionId === "write-tests")!;

    // Domain scorer produces in-range scores with agent-specific reasons
    expect(ship.score).toBeGreaterThanOrEqual(0);
    expect(ship.score).toBeLessThanOrEqual(1);
    expect(tests.reason).toMatch(/coverage|quality|shipped|debt|deadline|risk|reward/i);

    // Explicit domain score API is stable
    const physical = scoreBranch(ship, "robot-arm").score;
    const domain = scoreBranch(ship, "forge").score;
    expect(domain).not.toBe(physical);
  });
});
