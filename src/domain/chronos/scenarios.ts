// Chronos Core — Preset Scenarios

import type { Scenario } from "./types";

export const scenarios: Scenario[] = [
  {
    id: "robot-arm",
    name: "Robotic Arm",
    description:
      "A 6-DOF arm must grasp an object on a workbench while a human is nearby and wind is present.",
    initialState: {
      robot: { x: 120, y: 200, armAngle: 0, gripOpen: true },
      object: { x: 280, y: 200, stable: true, grasped: false },
      environment: { humanPresent: true, wind: 3, lighting: "bright" },
      timestamp: 0,
    },
    actions: [
      {
        id: "grasp-direct",
        name: "Grasp directly",
        description: "Move arm straight to the object and close grip.",
        apply: () => ({
          robot: { x: 280, y: 200, armAngle: 0, gripOpen: false },
          object: { grasped: true },
        }),
        baseRisk: 0.2,
        baseReward: 0.9,
      },
      {
        id: "approach-cautious",
        name: "Approach cautiously",
        description: "Slow approach, verify object stability first.",
        apply: (state) => ({
          robot: { x: 260, y: 200, armAngle: 0, gripOpen: true },
          object: { ...state.object, stable: true },
        }),
        baseRisk: 0.1,
        baseReward: 0.7,
      },
      {
        id: "wait-for-human",
        name: "Wait for human to clear",
        description: "Hold position until the human leaves the zone.",
        apply: (state) => ({
          environment: { ...state.environment, humanPresent: false },
        }),
        baseRisk: 0.05,
        baseReward: 0.5,
      },
      {
        id: "retreat",
        name: "Retreat to safe position",
        description: "Move arm back to home position to avoid collision.",
        apply: () => ({
          robot: { x: 120, y: 120, armAngle: -45, gripOpen: true },
        }),
        baseRisk: 0.02,
        baseReward: 0.2,
      },
    ],
  },
  {
    id: "self-driving",
    name: "Self-Driving",
    description: "An autonomous vehicle must decide whether to change lanes on a busy highway.",
    initialState: {
      robot: { x: 200, y: 300, armAngle: 0, gripOpen: true },
      object: { x: 400, y: 300, stable: true, grasped: false },
      environment: { humanPresent: true, wind: 1, lighting: "dim" },
      timestamp: 0,
    },
    actions: [
      {
        id: "change-lane-left",
        name: "Change lane (left)",
        description: "Move to the left lane to pass slower traffic.",
        apply: (state) => ({
          robot: { ...state.robot, y: 200 },
          environment: { ...state.environment, humanPresent: false },
        }),
        baseRisk: 0.35,
        baseReward: 0.8,
      },
      {
        id: "maintain-lane",
        name: "Maintain lane",
        description: "Stay in current lane and match speed.",
        apply: (state) => ({
          robot: { ...state.robot, x: state.robot.x + 50 },
        }),
        baseRisk: 0.1,
        baseReward: 0.5,
      },
      {
        id: "slow-down",
        name: "Reduce speed",
        description: "Drop back to a safer following distance.",
        apply: () => ({
          robot: { x: 100, y: 300, armAngle: 0, gripOpen: true },
        }),
        baseRisk: 0.05,
        baseReward: 0.3,
      },
      {
        id: "emergency-stop",
        name: "Emergency stop",
        description: "Pull over and stop completely.",
        apply: () => ({
          robot: { x: 200, y: 400, armAngle: 0, gripOpen: true },
        }),
        baseRisk: 0.15,
        baseReward: 0.1,
      },
    ],
  },
  {
    id: "trading",
    name: "Trading Bot",
    description:
      "An algorithmic trader must decide whether to buy, sell, or hold a position amid volatile markets.",
    initialState: {
      robot: { x: 200, y: 250, armAngle: 0, gripOpen: true },
      object: { x: 200, y: 250, stable: false, grasped: false },
      environment: { humanPresent: false, wind: 8, lighting: "bright" },
      timestamp: 0,
    },
    actions: [
      {
        id: "buy",
        name: "Buy 100 shares",
        description: "Enter a long position on upward momentum signal.",
        apply: (state) => ({
          object: { ...state.object, grasped: true },
        }),
        baseRisk: 0.6,
        baseReward: 0.85,
      },
      {
        id: "hold",
        name: "Hold position",
        description: "Maintain current exposure and wait for clarity.",
        apply: () => ({}),
        baseRisk: 0.2,
        baseReward: 0.3,
      },
      {
        id: "sell-partial",
        name: "Sell 50% of position",
        description: "Take partial profits, reduce exposure.",
        apply: (state) => ({
          robot: { ...state.robot, y: 300 },
        }),
        baseRisk: 0.15,
        baseReward: 0.5,
      },
      {
        id: "sell-all",
        name: "Liquidate",
        description: "Exit all positions — capital preservation mode.",
        apply: () => ({
          robot: { x: 200, y: 400, armAngle: 0, gripOpen: true },
          object: { grasped: false },
        }),
        baseRisk: 0.05,
        baseReward: 0.2,
      },
    ],
  },
];

export function getScenario(id: string): Scenario {
  return scenarios.find((s) => s.id === id) ?? scenarios[0];
}
