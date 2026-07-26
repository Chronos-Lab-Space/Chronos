// Chronos Core — Temporal Decision Engine
// Pure functions. No side effects. Deterministic given the same Simulation.

import type {
  WorldState,
  Action,
  Engine,
  LogEntry,
  Phase,
  CollapseStrategy,
} from "../../domain/chronos/types";
import {
  Branch,
  Collapse,
  Decision,
  Hypothesis,
  Outcome,
  Simulation,
  Timeline,
} from "../../domain/chronos/entities";

let simulationCounter = 0;

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function branchId(engine: Engine, actionId: string): string {
  return `br-${engine.id}-${actionId}`;
}

function logId(engine: Engine, phase: Phase): string {
  return `log-${engine.id}-${phase}-${engine.log.length}`;
}

function applyDelta(world: WorldState, delta: ReturnType<Action["apply"]>): WorldState {
  return {
    ...world,
    robot: { ...world.robot, ...delta.robot },
    object: { ...world.object, ...delta.object },
    environment: { ...world.environment, ...delta.environment },
    timestamp: world.timestamp + 1,
  };
}

// ---- Fork ----
// Creates one branch per candidate action by applying the action's delta
// to the current world state. Branch ids are deterministic per simulation + action.

export function fork(engine: Engine): Engine {
  if (engine.phase !== "idle") return engine;
  if (engine.actions.length === 0) return engine;

  const hypotheses = engine.actions.map((action) => Hypothesis.fromAction(action));
  const branches: Branch[] = hypotheses.map((hypothesis) => {
    const action = hypothesis.action;
    const nextState = applyDelta(engine.world, action.apply(engine.world));

    return new Branch({
      id: branchId(engine, action.id),
      hypothesis,
      state: nextState,
    });
  });

  const log: LogEntry = {
    id: logId(engine, "forked"),
    phase: "forked",
    message: `fork → ${branches.length} branches`,
    color: "#c6f0ff",
    timestamp: Date.now(),
  };

  return engine.with({
    branches,
    phase: "forked",
    log: [...engine.log, log],
    timeline: engine.timeline.registerBranches(branches).record(log),
    decision: engine.decision.withHypotheses(hypotheses),
    status: "running",
  });
}

// ---- Evaluate ----
// Domain-aware scoring: physical scenarios use kinematics/safety utility;
// agent workloads (forge / oracle / atlas) score against domain EV semantics
// encoded in the shared WorldState metaphor.

export type ScoreBreakdown = {
  score: number;
  reasons: string[];
};

/** Physical / robotics utility — preserves legacy robot-arm scores. */
export function scorePhysical(branch: Branch): ScoreBreakdown {
  const { state, risk, reward } = branch;
  const reasons: string[] = [];

  let utility = reward * 1.0 - risk * 0.8;

  if (state.environment.humanPresent) {
    utility -= 0.15;
    reasons.push("human near");
  }
  if (state.environment.wind > 5) {
    utility -= (state.environment.wind - 5) * 0.04;
    reasons.push("wind");
  }
  if (state.environment.lighting === "dark") {
    utility -= 0.1;
    reasons.push("dark");
  } else if (state.environment.lighting === "dim") {
    utility -= 0.04;
  }

  if (!state.object.stable) {
    utility -= 0.12;
    reasons.push("unstable");
  }

  const dx = state.robot.x - state.object.x;
  const dy = state.robot.y - state.object.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  if (distance < 20) {
    utility += 0.08;
  }

  if (state.object.grasped) {
    utility += 0.15;
    reasons.push("grasped");
  }

  if (risk > 0.5) reasons.push("high-risk");
  if (reward > 0.7) reasons.push("high-reward");

  return {
    score: clamp01(utility),
    reasons: reasons.length ? reasons : ["neutral"],
  };
}

/**
 * Forge (coding): robot.y ≈ days late, armAngle ≈ quality, object.stable ≈ coverage,
 * grasped ≈ shipped, wind ≈ debt pressure, humanPresent ≈ stakeholder review.
 */
export function scoreForge(branch: Branch): ScoreBreakdown {
  const { state, risk, reward } = branch;
  const reasons: string[] = [];
  const quality = clamp01(state.robot.armAngle / 100);
  const daysLate = Math.max(0, state.robot.y);
  const debt = clamp01(state.environment.wind / 10);
  const shipped = state.object.grasped;
  const coverageOk = state.object.stable;

  // EV: reward discounted by risk, then domain adjustments.
  let utility = reward * (1 - risk * 0.75);

  if (shipped) {
    utility += 0.1;
    reasons.push("shipped");
  } else {
    reasons.push("unshipped");
  }
  if (coverageOk) {
    utility += 0.08;
    reasons.push("coverage-stable");
  }
  utility += quality * 0.12;
  if (quality >= 0.7) reasons.push("high-quality");

  utility -= debt * 0.14;
  if (debt >= 0.7) reasons.push("debt-pressure");

  if (daysLate > 3) {
    utility -= (daysLate - 3) * 0.035;
    reasons.push("deadline-slip");
  }
  if (state.environment.humanPresent && !shipped && daysLate > 0) {
    utility -= 0.06;
    reasons.push("stakeholder-waiting");
  }
  if (risk > 0.5) reasons.push("high-risk");
  if (reward > 0.7) reasons.push("high-reward");

  return { score: clamp01(utility), reasons: reasons.length ? reasons : ["neutral"] };
}

/**
 * Oracle (trading): robot.x ≈ position size, y ≈ vol, armAngle ≈ conviction,
 * object.y ≈ P&L bps, stable ≈ tape, wind ≈ macro shock.
 */
export function scoreOracle(branch: Branch): ScoreBreakdown {
  const { state, risk, reward } = branch;
  const reasons: string[] = [];
  const exposure = clamp01(state.robot.x / 100);
  const vol = clamp01(state.robot.y / 100);
  const conviction = clamp01(state.robot.armAngle / 100);
  const pnl = state.object.y;
  const macro = clamp01(state.environment.wind / 10);
  const tapeStable = state.object.stable;
  const inMarket = state.object.grasped;

  let utility = reward * (1 - risk * 0.85);

  utility += conviction * 0.1;
  if (conviction >= 0.4) reasons.push("conviction");

  // Normalize light P&L contribution (bps scale used by agent defs).
  utility += clamp01(0.5 + pnl / 40) * 0.12 - 0.06;
  if (pnl >= 5) reasons.push("pnl-up");
  if (pnl <= 0 && inMarket) reasons.push("flat-pnl");

  if (tapeStable) {
    utility += 0.07;
    reasons.push("tape-stable");
  }

  // Exposure × macro shock is the primary tail penalty.
  const tail = exposure * macro;
  utility -= tail * 0.18;
  if (tail >= 0.5) reasons.push("macro-exposure");

  if (exposure > 0.85 && vol > 0.3) {
    utility -= 0.1;
    reasons.push("high-vol-size");
  }
  if (!inMarket) {
    utility -= 0.02;
    reasons.push("flat");
  }
  if (risk > 0.5) reasons.push("high-risk");
  if (reward > 0.7) reasons.push("high-reward");

  return { score: clamp01(utility), reasons: reasons.length ? reasons : ["neutral"] };
}

/**
 * Atlas (startup): robot.x ≈ runway months, y ≈ MRR, armAngle ≈ momentum,
 * object.x ≈ churn %, y ≈ competitor capital, wind ≈ competitive pressure.
 */
export function scoreAtlas(branch: Branch): ScoreBreakdown {
  const { state, risk, reward } = branch;
  const reasons: string[] = [];
  const runway = state.robot.x;
  const mrr = state.robot.y;
  const momentum = clamp01(state.robot.armAngle / 100);
  const churn = Math.max(0, state.object.x);
  const competitive = clamp01(state.environment.wind / 10);

  let utility = reward * (1 - risk * 0.7);

  // Runway buffer above ~6 months is optionality.
  if (runway >= 18) {
    utility += 0.1;
    reasons.push("deep-runway");
  } else if (runway >= 12) {
    utility += 0.06;
    reasons.push("runway-ok");
  } else if (runway < 8) {
    utility -= 0.1;
    reasons.push("runway-tight");
  }

  utility += clamp01(mrr / 400) * 0.1;
  if (mrr >= 250) reasons.push("mrr-scale");

  utility += momentum * 0.12;
  if (momentum >= 0.65) reasons.push("momentum");

  utility -= Math.min(0.12, churn * 0.025);
  if (churn >= 4) reasons.push("churn");

  utility -= competitive * 0.1;
  if (competitive >= 0.7) reasons.push("competitive-pressure");

  if (state.environment.humanPresent) {
    // Board watching: punish pure stall slightly, reward decisive growth paths via reward already.
    if (reward < 0.4) {
      utility -= 0.05;
      reasons.push("board-impatient");
    }
  }
  if (risk > 0.5) reasons.push("high-risk");
  if (reward > 0.7) reasons.push("high-reward");

  return { score: clamp01(utility), reasons: reasons.length ? reasons : ["neutral"] };
}

/** Resolve scorer from scenario id (agent workloads + physical defaults). */
export function scoreBranch(branch: Branch, scenarioId: string): ScoreBreakdown {
  switch (scenarioId) {
    case "forge":
      return scoreForge(branch);
    case "oracle":
      return scoreOracle(branch);
    case "atlas":
      return scoreAtlas(branch);
    default:
      return scorePhysical(branch);
  }
}

export function evaluate(engine: Engine): Engine {
  if (engine.phase !== "forked") return engine;

  const branches = engine.branches.map((branch) => {
    const { score, reasons } = scoreBranch(branch, engine.scenarioId);
    const outcome = new Outcome({
      branchId: branch.id,
      score,
      reason: reasons.join(" · "),
      risk: branch.hypothesis.action.baseRisk,
      reward: branch.hypothesis.action.baseReward,
    });
    return branch.withOutcome(outcome);
  });

  const log: LogEntry = {
    id: logId(engine, "evaluated"),
    phase: "evaluated",
    message: `evaluate → scored ${branches.length} branches`,
    color: "#b79bff",
    timestamp: Date.now(),
  };

  return engine.with({
    branches,
    phase: "evaluated",
    log: [...engine.log, log],
    timeline: engine.timeline.record(log),
  });
}

// ---- Collapse ----
// Selects the winning branch by strategy, prunes the rest, commits world state.

function selectWinner(scored: readonly Branch[], strategy: CollapseStrategy): Branch {
  if (strategy === "min-risk") {
    return scored.reduce((best, b) => (b.risk < best.risk ? b : best));
  }
  if (strategy === "balanced") {
    return scored.reduce((best, b) => {
      const bScore = (b.reward ?? 0) - (b.risk ?? 0) / 2;
      const bestScore = (best.reward ?? 0) - (best.risk ?? 0) / 2;
      return bScore > bestScore ? b : best;
    });
  }
  // max-utility (default): highest evaluated score; stable tie-break on action id
  return scored.reduce((best, b) => {
    const bs = b.score ?? 0;
    const bests = best.score ?? 0;
    if (bs > bests) return b;
    if (bs < bests) return best;
    return b.actionId.localeCompare(best.actionId) < 0 ? b : best;
  });
}

export function collapse(engine: Engine, strategy: CollapseStrategy = "max-utility"): Engine {
  if (engine.phase !== "evaluated") return engine;

  const scored = engine.branches.filter((b) => b.score !== null);
  if (scored.length === 0) return engine;

  const winnerBranch = selectWinner(scored, strategy);
  const winnerId = winnerBranch.id;

  const branches = engine.branches.map((branch) =>
    branch.id === winnerId ? branch.select() : branch.prune()
  );

  const winner = branches.find((b) => b.id === winnerId)!;

  const log: LogEntry = {
    id: logId(engine, "collapsed"),
    phase: "collapsed",
    message: `collapse → branch_${winner.id} wins · score ${winner.score!.toFixed(3)}`,
    color: "#ffd7a3",
    timestamp: Date.now(),
  };

  const collapseRecord = new Collapse({
    id: `collapse-${engine.id}-${strategy}`,
    timelineId: engine.timeline.id,
    selectedBranchId: winner.id,
    discardedBranchIds: branches
      .filter((branch) => branch.id !== winner.id)
      .map((branch) => branch.id),
    strategy,
  });

  return engine.with({
    branches,
    world: winner.state,
    phase: "collapsed",
    log: [...engine.log, log],
    timeline: engine.timeline.registerBranches(branches).record(log).commit(winner, collapseRecord),
    status: "completed",
  });
}

/**
 * Run the full temporal loop: idle → forked → evaluated → collapsed.
 * Idempotent on already-collapsed engines. Safe to call mid-pipeline.
 */
export function run(engine: Engine, strategy: CollapseStrategy = "max-utility"): Engine {
  let next = engine;
  if (next.phase === "idle") next = fork(next);
  if (next.phase === "forked") next = evaluate(next);
  if (next.phase === "evaluated") next = collapse(next, strategy);
  return next;
}

// ---- Reset ----

export function reset(engine: Engine, initialWorld: WorldState): Engine {
  const log: LogEntry = {
    id: logId(engine, "idle"),
    phase: "idle",
    message: `reset → back to origin`,
    color: "#8a93a6",
    timestamp: Date.now(),
  };

  return engine.with({
    world: initialWorld,
    branches: [],
    phase: "idle",
    log: [...engine.log, log],
    timeline: new Timeline({
      id: engine.timeline.id,
      canonicalState: initialWorld,
      events: [...engine.timeline.events, log],
    }),
    status: "pending",
  });
}

// ---- Helpers ----

export function createEngine(scenarioId: string, world: WorldState, actions: Action[]): Engine {
  simulationCounter += 1;
  const id = `simulation-${scenarioId}-${simulationCounter}`;
  const readyLog: LogEntry = {
    id: `log-${id}-idle-0`,
    phase: "idle",
    message: `engine ready · ${actions.length} actions loaded`,
    color: "#c6f0ff",
    timestamp: Date.now(),
  };

  return new Simulation({
    id,
    scenarioId,
    world,
    actions,
    decision: new Decision({
      id: `decision-${id}`,
      goal: `Evaluate ${scenarioId}`,
      strategy: "max-utility",
    }),
    timeline: new Timeline({
      id: `timeline-${id}`,
      canonicalState: world,
      events: [readyLog],
    }),
    log: [readyLog],
  });
}

export function getPhaseLabel(phase: Phase): string {
  return {
    idle: "idle",
    forked: "forked",
    evaluated: "evaluated",
    collapsed: "collapsed",
  }[phase];
}
