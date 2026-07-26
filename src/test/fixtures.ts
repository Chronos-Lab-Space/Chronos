import type { WorldState } from "../domain/chronos/types";

export const deterministicWorld: WorldState = {
  robot: { x: 10, y: 10, armAngle: 0, gripOpen: true },
  object: { x: 20, y: 20, stable: true, grasped: false },
  environment: { humanPresent: false, wind: 0, lighting: "bright" },
  timestamp: 0,
};
