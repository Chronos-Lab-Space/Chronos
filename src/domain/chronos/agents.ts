// Chronos Agents — Domain-specific decision makers that use Chronos Core.
//
// Each agent brings:
//   - a narrative (what it does, what decisions it faces)
//   - a world model (what reality looks like from its perspective)
//   - candidate actions (what it's considering doing next)
//   - a scoring intuition (what "good" means in its domain)
//
// Chronos doesn't care about the domain. It runs the same engine:
//   fork → evaluate → collapse → commit
// The agent just brings its own reality.

import { Agent } from "./entities";

export { Agent } from "./entities";

// ---- Forge: the coding agent ----

const forge = new Agent({
  id: "forge",
  name: "Forge",
  tagline: "The coding agent.",
  description:
    "A coding agent with a feature branch, a ship deadline, and a hundred possible ways to land it. Forge doesn't just write code — it simulates every landing path and picks the one that ships value without mortgaging the codebase.",
  accent: "#c6f0ff",
  icon: "forge",
  narrative: {
    problem:
      "Ship a feature in 3 days. Test coverage is at 64%. There's a stakeholder review tomorrow. Tech debt is climbing.",
    whatItSimulates: [
      "What if I ship as-is and fix later?",
      "What if I refactor first, then ship?",
      "What if I write tests to close the gap?",
      "What if I defer to the next sprint?",
    ],
    stakes:
      "Every branch is a week of the team's life. The wrong call means bugs in production, lost trust, or a codebase that slows every future feature.",
  },
  scenario: {
    id: "forge",
    name: "Forge · feature branch",
    description:
      "A coding agent deciding how to land a feature with time pressure, technical debt, and stakeholder visibility.",
    initialState: {
      robot: { x: 68, y: 3, armAngle: 45, gripOpen: true }, // velocity: 68 pts/wk, 3 days left, quality 45°, feature flag ready
      object: { x: 240, y: 7, stable: false, grasped: false }, // target: -240 LOC refactor, 7 open bugs, coverage unstable
      environment: { humanPresent: true, wind: 6, lighting: "dim" }, // stakeholder reviewing, high debt pressure, team morale dipping
      timestamp: 0,
    },
    actions: [
      {
        id: "ship-as-is",
        name: "Ship as-is",
        description: "Merge the feature branch now. Fast to production, bugs deferred.",
        apply: (s) => ({
          robot: { ...s.robot, y: 0, gripOpen: false }, // deadline met
          object: { ...s.object, grasped: true }, // feature shipped
          environment: { ...s.environment, wind: 9 }, // debt pressure spikes
        }),
        baseRisk: 0.65,
        baseReward: 0.85,
      },
      {
        id: "refactor-first",
        name: "Refactor first",
        description: "Pay down the debt. Slower, but the codebase survives the next feature.",
        apply: (s) => ({
          robot: { ...s.robot, y: 5, armAngle: 80 }, // 2 days late, quality up
          object: { ...s.object, x: 0, y: 2, stable: true }, // refactor done, fewer bugs, coverage stable
        }),
        baseRisk: 0.2,
        baseReward: 0.6,
      },
      {
        id: "write-tests",
        name: "Write tests first",
        description: "Close the coverage gap. Medium delay, durable safety net.",
        apply: (s) => ({
          robot: { ...s.robot, y: 4 }, // 1 day late
          object: { ...s.object, y: 3, stable: true }, // fewer bugs, stable coverage
        }),
        baseRisk: 0.25,
        baseReward: 0.72,
      },
      {
        id: "defer",
        name: "Defer to next sprint",
        description: "Kick the decision. Safe for the codebase, costs stakeholder trust.",
        apply: (s) => ({
          robot: { ...s.robot, y: 7, armAngle: 30 }, // 4 more days, quality drops
          environment: { ...s.environment, humanPresent: false, lighting: "dark" }, // stakeholder gone, morale drops
        }),
        baseRisk: 0.4,
        baseReward: 0.3,
      },
    ],
  },
});

// ---- Oracle: the trading agent ----

const oracle = new Agent({
  id: "oracle",
  name: "Oracle",
  tagline: "The trading agent.",
  description:
    "A trading agent managing a position in a volatile market. Oracle doesn't react to price — it runs every scenario of the next hour, the next day, the next week, and picks the move that survives the most futures.",
  accent: "#b79bff",
  icon: "oracle",
  narrative: {
    problem:
      "Holding a $2.4M position. Volatility is 34%. Macro data drops in 40 minutes. The tape is thin.",
    whatItSimulates: [
      "What if I add to the position on this dip?",
      "What if I trim and lock in gains?",
      "What if I hedge with options ahead of the print?",
      "What if I flatten and wait for clarity?",
    ],
    stakes:
      "Every branch is a different P&L. The wrong call isn't just lost money — it's lost conviction, lost risk budget, and a team that second-guesses the next signal.",
  },
  scenario: {
    id: "oracle",
    name: "Oracle · live position",
    description:
      "A trading agent deciding how to manage a $2.4M position ahead of a macro event in a volatile tape.",
    initialState: {
      robot: { x: 72, y: 34, armAngle: 15, gripOpen: true }, // position size 72%, vol 34%, conviction low (15°)
      object: { x: 40, y: 4, stable: false, grasped: true }, // 40 min to data, 4 bps P&L, thin tape, position held
      environment: { humanPresent: false, wind: 8, lighting: "dim" }, // no human in the loop, macro wind strong, mixed signals
      timestamp: 0,
    },
    actions: [
      {
        id: "add",
        name: "Add to position",
        description: "Buy the dip. High conviction, high exposure if the print goes wrong.",
        apply: (s) => ({
          robot: { ...s.robot, x: 90, armAngle: 55 }, // position 90%, conviction up
          object: { ...s.object, y: 12 }, // potential 12 bps gain
        }),
        baseRisk: 0.7,
        baseReward: 0.85,
      },
      {
        id: "trim",
        name: "Trim 30%",
        description: "Lock in partial gains. Leave skin in the game without full exposure.",
        apply: (s) => ({
          robot: { ...s.robot, x: 50, armAngle: 35 }, // position 50%, conviction medium
          object: { ...s.object, y: 5 }, // moderate P&L locked
        }),
        baseRisk: 0.3,
        baseReward: 0.55,
      },
      {
        id: "hedge",
        name: "Hedge with puts",
        description: "Buy downside protection. Cost is paid upfront, tail risk is capped.",
        apply: (s) => ({
          robot: { ...s.robot, x: 72, armAngle: 40 }, // position unchanged, conviction up
          object: { ...s.object, y: 2, stable: true }, // small P&L cost, tape stabilizes
        }),
        baseRisk: 0.15,
        baseReward: 0.4,
      },
      {
        id: "flatten",
        name: "Flatten the book",
        description: "Exit everything. Wait for the print. Zero exposure, zero P&L.",
        apply: () => ({
          robot: { x: 0, y: 34, armAngle: 0, gripOpen: true },
          object: { x: 40, y: 0, stable: false, grasped: false },
        }),
        baseRisk: 0.05,
        baseReward: 0.15,
      },
    ],
  },
});

// ---- Atlas: the startup agent ----

const atlas = new Agent({
  id: "atlas",
  name: "Atlas",
  tagline: "The startup agent.",
  description:
    "A founder agent carrying every strategic choice on its back. Atlas doesn't guess at the next move — it runs every plausible quarter, scores each against runway and momentum, and commits to the path that keeps the company alive long enough to win.",
  accent: "#ffd7a3",
  icon: "atlas",
  narrative: {
    problem:
      "12 months of runway. $180k MRR. 4% monthly churn. A competitor just raised $40M. The board wants a decision by Friday.",
    whatItSimulates: [
      "What if we raise a Series A now?",
      "What if we ship the enterprise tier and move upmarket?",
      "What if we cut prices to accelerate growth?",
      "What if we hunker down and extend runway?",
    ],
    stakes:
      "Every branch is a different version of the company. The wrong call isn't just a bad quarter — it's a pivot that kills the culture, a raise that dilutes too much, or a product bet that misses the market by six months.",
  },
  scenario: {
    id: "atlas",
    name: "Atlas · board decision",
    description:
      "A founder agent deciding the company's next move with 12 months of runway, a rising competitor, and a board that wants clarity.",
    initialState: {
      robot: { x: 12, y: 180, armAngle: 60, gripOpen: true }, // 12 mo runway, $180k MRR, momentum 60°, optionality open
      object: { x: 4, y: 40, stable: false, grasped: false }, // 4% churn, $40M competitor, tape unstable
      environment: { humanPresent: true, wind: 7, lighting: "bright" }, // board watching, competitive wind strong, market clear
      timestamp: 0,
    },
    actions: [
      {
        id: "raise-a",
        name: "Raise Series A",
        description:
          "Take $18M at $70M pre. Runway doubles, but dilution is real and the bar goes up.",
        apply: (s) => ({
          robot: { ...s.robot, x: 24, y: 320 }, // 24 mo runway, $320k MRR target
          environment: { ...s.environment, humanPresent: false }, // board satisfied
        }),
        baseRisk: 0.4,
        baseReward: 0.82,
      },
      {
        id: "enterprise",
        name: "Ship enterprise tier",
        description: "Move upmarket. Bigger contracts, longer sales cycles, new product surface.",
        apply: (s) => ({
          robot: { ...s.robot, armAngle: 78, y: 210 }, // momentum up, slight MRR lift
          object: { ...s.object, y: 30 }, // competition less relevant
        }),
        baseRisk: 0.45,
        baseReward: 0.78,
      },
      {
        id: "cut-prices",
        name: "Cut prices 30%",
        description: "Accelerate growth at the cost of revenue per customer. Volume play.",
        apply: (s) => ({
          robot: { ...s.robot, y: 160, armAngle: 55 }, // MRR dips short-term
          object: { ...s.object, x: 2, y: 50 }, // churn drops, competition hurt
        }),
        baseRisk: 0.55,
        baseReward: 0.65,
      },
      {
        id: "hunker",
        name: "Extend runway, stay small",
        description: "Cut costs, pause hiring, buy time. Safe, but the window narrows.",
        apply: (s) => ({
          robot: { ...s.robot, x: 18, y: 150, armAngle: 40 }, // 18 mo runway, MRR flat, momentum drops
          environment: { ...s.environment, wind: 9 }, // competitive pressure grows
        }),
        baseRisk: 0.25,
        baseReward: 0.35,
      },
    ],
  },
});

export const agents: Agent[] = [forge, oracle, atlas];

export function getAgent(id: string): Agent {
  return agents.find((a) => a.id === id) ?? agents[0];
}
