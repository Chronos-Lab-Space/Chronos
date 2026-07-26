import { describe, expect, it } from "vitest";
import { Branch, Hypothesis, Timeline } from "./entities";
import type { Action, LogEntry } from "./types";
import { deterministicWorld } from "../../test/fixtures";

describe("Timeline snapshots", () => {
  it("preserves the replayable record and canonical state after a branch commit", () => {
    const action: Action = {
      id: "safe-action",
      name: "Safe action",
      description: "A deterministic action for timeline snapshots.",
      apply: () => ({ robot: { x: 11 } }),
      baseRisk: 0.1,
      baseReward: 0.7,
    };
    const event: LogEntry = {
      id: "event-fork-01",
      phase: "forked",
      message: "fork -> 1 branch",
      color: "#c6f0ff",
      timestamp: 1_700_000_000_000,
    };
    const branch = new Branch({
      id: "branch-01",
      hypothesis: Hypothesis.fromAction(action),
      state: { ...deterministicWorld, robot: { ...deterministicWorld.robot, x: 11 } },
    }).select();

    const timeline = new Timeline({
      id: "timeline-01",
      canonicalState: deterministicWorld,
    })
      .record(event)
      .commit(branch);

    expect({
      id: timeline.id,
      committedBranchId: timeline.committedBranchId,
      canonicalState: timeline.canonicalState,
      events: timeline.events,
    }).toMatchInlineSnapshot(`
      {
        "canonicalState": {
          "environment": {
            "humanPresent": false,
            "lighting": "bright",
            "wind": 0,
          },
          "object": {
            "grasped": false,
            "stable": true,
            "x": 20,
            "y": 20,
          },
          "robot": {
            "armAngle": 0,
            "gripOpen": true,
            "x": 11,
            "y": 10,
          },
          "timestamp": 0,
        },
        "committedBranchId": "branch-01",
        "events": [
          {
            "color": "#c6f0ff",
            "id": "event-fork-01",
            "message": "fork -> 1 branch",
            "phase": "forked",
            "timestamp": 1700000000000,
          },
        ],
        "id": "timeline-01",
      }
    `);
  });
});
