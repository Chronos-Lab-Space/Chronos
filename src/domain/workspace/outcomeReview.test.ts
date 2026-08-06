import { describe, expect, it } from "vitest";
import {
  DEFAULT_REVIEW_HORIZON,
  REVIEW_HORIZONS,
  deriveOutcomeReview,
  reviewAtFor,
} from "./outcomeReview";
import type { OutcomeFollowed, OutcomeVerdict, SimulationRecord, WorkspaceHome } from "./types";

const WS = "11111111-1111-4111-8111-111111111111";
const NOW = new Date("2026-08-06T12:00:00.000Z");

let seq = 0;
function simId(): string {
  seq += 1;
  return `00000000-0000-4000-8000-${String(seq).padStart(12, "0")}`;
}

/** A saved run, optionally with a review date and a logged outcome. */
function run(partial: {
  reviewAt?: string | null;
  followed?: OutcomeFollowed | null;
  verdict?: OutcomeVerdict | null;
  chosen?: boolean;
  status?: SimulationRecord["status"];
  title?: string;
}): SimulationRecord {
  const id = simId();
  const chosen = partial.chosen ?? true;
  return {
    id,
    workspace_id: WS,
    goal_id: null,
    title: partial.title ?? "How should we launch?",
    status: partial.status ?? "completed",
    confidence: 0.72,
    result: {
      ...(chosen
        ? { chosen_at: "2026-07-01T00:00:00.000Z", chosen_future_name: "Focused launch" }
        : {}),
      ...(partial.reviewAt === undefined ? {} : { review_at: partial.reviewAt }),
      outcome_followed: partial.followed ?? null,
      outcome_verdict: partial.verdict ?? null,
    },
    created_at: "2026-07-01T00:00:00.000Z",
    version: 1,
    lineage_id: id,
    parent_simulation_id: null,
    decision_id: id,
  };
}

function home(sims: readonly SimulationRecord[]): WorkspaceHome {
  return {
    workspace: {
      id: WS,
      owner_id: "u1",
      name: "Lab",
      description: "",
      created_at: "2026-01-01T00:00:00.000Z",
    },
    goal: null,
    goalHistory: [],
    recentSimulations: sims,
    decisions: [],
    knowledge: [],
    notes: [],
    futuresBySimulation: {},
    timelineBySimulation: {},
  };
}

describe("reviewAtFor", () => {
  it("adds the horizon's days to the given instant", () => {
    expect(reviewAtFor("2w", NOW)).toBe("2026-08-20T12:00:00.000Z");
    expect(reviewAtFor("1m", NOW)).toBe("2026-09-05T12:00:00.000Z");
    expect(reviewAtFor("3m", NOW)).toBe("2026-11-04T12:00:00.000Z");
  });

  it("returns null for the explicit no-review horizon", () => {
    expect(reviewAtFor("never", NOW)).toBeNull();
  });

  it("offers a default horizon that exists in the table", () => {
    expect(REVIEW_HORIZONS.some((h) => h.id === DEFAULT_REVIEW_HORIZON)).toBe(true);
  });
});

describe("deriveOutcomeReview — what Chronos may ask about", () => {
  it("queues a saved run whose review date has passed", () => {
    const result = deriveOutcomeReview(home([run({ reviewAt: "2026-08-03T12:00:00.000Z" })]), NOW);
    expect(result.due).toHaveLength(1);
    expect(result.due[0]!.daysOverdue).toBe(3);
    expect(result.due[0]!.href).toBe(
      `/workspace/simulations/${result.due[0]!.simulationId}#outcome`
    );
  });

  it("queues a run due at this exact instant", () => {
    const result = deriveOutcomeReview(home([run({ reviewAt: NOW.toISOString() })]), NOW);
    expect(result.due).toHaveLength(1);
    expect(result.due[0]!.daysOverdue).toBe(0);
  });

  it("counts a future review date as upcoming, not due", () => {
    const result = deriveOutcomeReview(home([run({ reviewAt: "2026-09-01T12:00:00.000Z" })]), NOW);
    expect(result.due).toHaveLength(0);
    expect(result.upcomingCount).toBe(1);
  });

  it("drops a run once a verdict is logged — the queue exists to collect it", () => {
    const result = deriveOutcomeReview(
      home([
        run({ reviewAt: "2026-08-01T12:00:00.000Z", followed: "yes", verdict: "as_expected" }),
      ]),
      NOW
    );
    expect(result.due).toHaveLength(0);
  });

  it("drops a run the user did not follow — calibration can never measure it", () => {
    const result = deriveOutcomeReview(
      home([run({ reviewAt: "2026-08-01T12:00:00.000Z", followed: "no" })]),
      NOW
    );
    expect(result.due).toHaveLength(0);
  });

  it("treats a legacy save with no review date as never, not as overdue", () => {
    const result = deriveOutcomeReview(home([run({})]), NOW);
    expect(result.due).toHaveLength(0);
    expect(result.awaitingCount).toBe(1);
  });

  it("treats an explicit null the same as never", () => {
    const result = deriveOutcomeReview(home([run({ reviewAt: null })]), NOW);
    expect(result.due).toHaveLength(0);
    expect(result.awaitingCount).toBe(1);
  });

  it("ignores an unparseable review date rather than pinning a permanent row", () => {
    const result = deriveOutcomeReview(home([run({ reviewAt: "not-a-date" })]), NOW);
    expect(result.due).toHaveLength(0);
    expect(result.awaitingCount).toBe(1);
  });

  it("ignores a run with no saved path — there is no decision to review", () => {
    const result = deriveOutcomeReview(
      home([run({ reviewAt: "2026-08-01T12:00:00.000Z", chosen: false })]),
      NOW
    );
    expect(result.due).toHaveLength(0);
    expect(result.awaitingCount).toBe(0);
  });

  it("ignores a run that never collapsed", () => {
    const result = deriveOutcomeReview(
      home([run({ reviewAt: "2026-08-01T12:00:00.000Z", status: "running" })]),
      NOW
    );
    expect(result.due).toHaveLength(0);
  });

  it("orders the queue oldest-due first", () => {
    const result = deriveOutcomeReview(
      home([
        run({ reviewAt: "2026-08-05T12:00:00.000Z", title: "Recent" }),
        run({ reviewAt: "2026-07-06T12:00:00.000Z", title: "Ancient" }),
      ]),
      NOW
    );
    expect(result.due.map((d) => d.decisionTitle)).toEqual(["Ancient", "Recent"]);
    expect(result.due[0]!.daysOverdue).toBe(31);
  });

  it("carries the chosen path name for context", () => {
    const result = deriveOutcomeReview(home([run({ reviewAt: "2026-08-01T12:00:00.000Z" })]), NOW);
    expect(result.due[0]!.chosenPathName).toBe("Focused launch");
  });

  it("prefers the goal title over the run title when a goal is set", () => {
    const base = home([run({ reviewAt: "2026-08-01T12:00:00.000Z" })]);
    const withGoal: WorkspaceHome = {
      ...base,
      goal: {
        id: "g1",
        workspace_id: WS,
        title: "Should we raise or extend runway?",
        description: "",
        status: "active",
        priority: 1,
        created_at: "2026-07-01T00:00:00.000Z",
      },
    };
    const result = deriveOutcomeReview(withGoal, NOW);
    expect(result.due[0]!.decisionTitle).toBe("Should we raise or extend runway?");
  });

  it("returns an empty queue for a missing home", () => {
    const result = deriveOutcomeReview(null, NOW);
    expect(result.due).toEqual([]);
    expect(result.upcomingCount).toBe(0);
    expect(result.awaitingCount).toBe(0);
  });
});
