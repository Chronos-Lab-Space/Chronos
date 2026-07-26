/**
 * Agent simulation run orchestration.
 *
 * Chronos agents supply a scenario (world + candidate actions). This runner
 * executes the temporal loop (fork → evaluate → collapse) and returns a
 * structured decision artifact: ranked EVs, winner, and explainable reasons.
 *
 * Pure application logic — no I/O.
 */

import { getAgent, type Agent } from "../../domain/chronos/agents";
import type { Branch, Simulation } from "../../domain/chronos/entities";
import type { CollapseStrategy, Scenario } from "../../domain/chronos/types";
import { createEngine, run } from "./engine";

export type RankedBranch = {
  branchId: string;
  actionId: string;
  name: string;
  score: number;
  risk: number;
  reward: number;
  /** Expected value proxy used for ranking under max-utility. */
  expectedValue: number;
  reason: string;
  status: Branch["status"];
};

export type AgentSimulationResult = {
  agentId: string | null;
  scenarioId: string;
  strategy: CollapseStrategy;
  simulation: Simulation;
  winner: RankedBranch | null;
  ranked: RankedBranch[];
  /** Winner EV minus mean alternative EV — positive means clear separation. */
  edge: number;
  phases: readonly string[];
};

export type AgentSimulationInput = {
  /** Named agent workload (forge | oracle | atlas). */
  agentId?: string;
  /** Explicit scenario override (tests / language compiler). */
  scenario?: Scenario;
  strategy?: CollapseStrategy;
  /** Optional Agent instance when not resolving by id. */
  agent?: Agent;
};

function toRanked(branch: Branch): RankedBranch {
  const score = branch.score ?? 0;
  const risk = branch.risk;
  const reward = branch.reward;
  return {
    branchId: branch.id,
    actionId: branch.actionId,
    name: branch.actionName,
    score,
    risk,
    reward,
    // EV proxy: evaluated score is domain-aware EV; also expose reward*(1-risk).
    expectedValue: score,
    reason: branch.reason ?? "",
    status: branch.status,
  };
}

/**
 * Run one full agent decision cycle and rank futures by expected value.
 */
export function runAgentSimulation(input: AgentSimulationInput): AgentSimulationResult {
  const strategy = input.strategy ?? "max-utility";
  const agent = input.agent ?? (input.agentId ? getAgent(input.agentId) : undefined);
  const scenario = input.scenario ?? agent?.scenario;

  if (!scenario) {
    throw new Error("runAgentSimulation requires agentId, agent, or scenario.");
  }

  const engine = createEngine(scenario.id, scenario.initialState, scenario.actions);
  const simulation = run(engine, strategy);

  const ranked = [...simulation.branches]
    .map(toRanked)
    .sort(
      (a, b) =>
        b.expectedValue - a.expectedValue || a.risk - b.risk || a.actionId.localeCompare(b.actionId)
    );

  const winnerBranch = simulation.winner;
  const winner = winnerBranch ? toRanked(winnerBranch) : null;

  const alternatives = ranked.filter((r) => r.branchId !== winner?.branchId);
  const meanAlt =
    alternatives.length > 0
      ? alternatives.reduce((sum, r) => sum + r.expectedValue, 0) / alternatives.length
      : 0;
  const edge = winner ? winner.expectedValue - meanAlt : 0;

  return {
    agentId: agent?.id ?? null,
    scenarioId: scenario.id,
    strategy,
    simulation,
    winner,
    ranked,
    edge: Math.round(edge * 1000) / 1000,
    phases: simulation.timeline.events.map((e) => e.phase),
  };
}

/** Convenience: run by agent id with default max-utility collapse. */
export function runAgent(
  agentId: string,
  strategy: CollapseStrategy = "max-utility"
): AgentSimulationResult {
  return runAgentSimulation({ agentId, strategy });
}
