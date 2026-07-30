import { describe, expect, it } from "vitest";
import {
  attachDecisions,
  decisionIdForSimulation,
  deriveDecisionStatus,
  groupDecisionsWithVersions,
} from "./decision";
import type { DecisionRecord, SimulationRecord, WorkspaceHome } from "./types";

const WS = "11111111-1111-4111-8111-111111111111";
const LINEAGE_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const LINEAGE_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const SIM_1 = "00000000-0000-4000-8000-000000000001";
const SIM_2 = "00000000-0000-4000-8000-000000000002";
const SIM_3 = "00000000-0000-4000-8000-000000000003";

function sim(partial: Partial<SimulationRecord> & Pick<SimulationRecord, "id">): SimulationRecord {
  return {
    workspace_id: WS,
    goal_id: null,
    title: "How should we launch?",
    status: "completed",
    confidence: 0.7,
    result: {},
    created_at: "2026-01-01T00:00:00.000Z",
    version: 1,
    lineage_id: partial.id,
    parent_simulation_id: null,
    decision_id: null,
    ...partial,
  };
}

function home(overrides: Partial<WorkspaceHome> = {}): WorkspaceHome {
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
    recentSimulations: [],
    decisions: [],
    knowledge: [],
    notes: [],
    futuresBySimulation: {},
    timelineBySimulation: {},
    ...overrides,
  };
}

describe("decisionIdForSimulation", () => {
  it("uses the lineage id, so every version of one question maps to one decision", () => {
    expect(decisionIdForSimulation(sim({ id: SIM_1, lineage_id: LINEAGE_A }))).toBe(LINEAGE_A);
    expect(decisionIdForSimulation(sim({ id: SIM_2, lineage_id: LINEAGE_A }))).toBe(LINEAGE_A);
  });

  it("falls back to the simulation id when the lineage id is not a uuid", () => {
    // Legacy local data can carry a demo lineage. `decisions.id` is a uuid
    // column, so the only safe stable key left is the simulation's own id.
    expect(decisionIdForSimulation(sim({ id: SIM_1, lineage_id: "0x8d21" }))).toBe(SIM_1);
    expect(decisionIdForSimulation(sim({ id: SIM_1, lineage_id: "" }))).toBe(SIM_1);
  });

  it("normalises case, so a client and Postgres agree on the same key", () => {
    expect(decisionIdForSimulation(sim({ id: SIM_1, lineage_id: LINEAGE_A.toUpperCase() }))).toBe(
      LINEAGE_A
    );
  });
});

describe("deriveDecisionStatus", () => {
  it("open while no version has collapsed to a path", () => {
    expect(deriveDecisionStatus([sim({ id: SIM_1 })])).toBe("open");
  });

  it("decided once a version has a chosen path", () => {
    expect(deriveDecisionStatus([sim({ id: SIM_1, result: { chosen_future_id: "f1" } })])).toBe(
      "decided"
    );
  });

  it("executed once the chosen version has a logged outcome", () => {
    expect(
      deriveDecisionStatus([
        sim({
          id: SIM_1,
          result: { chosen_future_id: "f1", outcome_result: "Shipped; retention healthy." },
        }),
      ])
    ).toBe("executed");
  });

  it("stays decided when the outcome sits on a version that was never chosen", () => {
    // Otherwise a stray outcome on an abandoned re-run would claim the whole
    // decision was executed.
    expect(
      deriveDecisionStatus([
        sim({ id: SIM_1, result: { chosen_future_id: "f1" } }),
        sim({ id: SIM_2, result: { outcome_result: "noise" } }),
      ])
    ).toBe("decided");
  });

  it("open for a decision with no versions at all", () => {
    expect(deriveDecisionStatus([])).toBe("open");
  });
});

describe("attachDecisions", () => {
  it("gives every simulation a decision, one per lineage", () => {
    const out = attachDecisions(
      home({
        recentSimulations: [
          sim({ id: SIM_2, lineage_id: LINEAGE_A, version: 2 }),
          sim({ id: SIM_1, lineage_id: LINEAGE_A, version: 1 }),
          sim({ id: SIM_3, lineage_id: LINEAGE_B, version: 1 }),
        ],
      })
    );

    expect(out.recentSimulations.map((s) => s.decision_id)).toEqual([
      LINEAGE_A,
      LINEAGE_A,
      LINEAGE_B,
    ]);
    expect(out.decisions).toHaveLength(2);
    expect(out.decisions.map((d) => d.id).sort()).toEqual([LINEAGE_A, LINEAGE_B]);
  });

  it("takes title, goal and created_at from the earliest version", () => {
    const out = attachDecisions(
      home({
        recentSimulations: [
          sim({
            id: SIM_2,
            lineage_id: LINEAGE_A,
            version: 2,
            title: "Retitled on the re-run",
            created_at: "2026-03-01T00:00:00.000Z",
            goal_id: "g2",
          }),
          sim({
            id: SIM_1,
            lineage_id: LINEAGE_A,
            version: 1,
            title: "How should we launch?",
            created_at: "2026-01-01T00:00:00.000Z",
            goal_id: "g1",
          }),
        ],
      })
    );

    expect(out.decisions[0]).toMatchObject({
      id: LINEAGE_A,
      workspace_id: WS,
      title: "How should we launch?",
      created_at: "2026-01-01T00:00:00.000Z",
      goal_id: "g1",
    });
  });

  it("is idempotent — re-deriving produces the same decisions, not duplicates", () => {
    const first = attachDecisions(
      home({
        recentSimulations: [
          sim({ id: SIM_1, lineage_id: LINEAGE_A }),
          sim({ id: SIM_3, lineage_id: LINEAGE_B }),
        ],
      })
    );
    const second = attachDecisions(first);

    expect(second.decisions).toEqual(first.decisions);
    expect(second.recentSimulations).toEqual(first.recentSimulations);
  });

  it("never overwrites a decision record that already exists", () => {
    // The cloud copy, or a title the user edited, is the source of truth.
    const existing: DecisionRecord = {
      id: LINEAGE_A,
      workspace_id: WS,
      title: "A title the user wrote",
      description: "with a description",
      goal_id: null,
      created_at: "2025-12-01T00:00:00.000Z",
    };
    const out = attachDecisions(
      home({
        decisions: [existing],
        recentSimulations: [sim({ id: SIM_1, lineage_id: LINEAGE_A, title: "engine objective" })],
      })
    );

    expect(out.decisions).toEqual([existing]);
  });

  it("keeps a decision_id a simulation already carries", () => {
    // Cloud rows arrive with decision_id already set by the backfill; guessing
    // again from the lineage would fight the server.
    const out = attachDecisions(
      home({
        recentSimulations: [sim({ id: SIM_1, lineage_id: LINEAGE_A, decision_id: LINEAGE_B })],
      })
    );

    expect(out.recentSimulations[0].decision_id).toBe(LINEAGE_B);
  });

  it("drops decisions whose versions are all gone", () => {
    // Retention trims the local simulation cache; a decision with nothing
    // under it would render as an empty row.
    const out = attachDecisions(
      home({
        decisions: [
          {
            id: LINEAGE_B,
            workspace_id: WS,
            title: "Orphan",
            description: "",
            goal_id: null,
            created_at: "2026-01-01T00:00:00.000Z",
          },
        ],
        recentSimulations: [sim({ id: SIM_1, lineage_id: LINEAGE_A })],
      })
    );

    expect(out.decisions.map((d) => d.id)).toEqual([LINEAGE_A]);
  });

  it("returns the same home reference when nothing changes", () => {
    // normalize() runs on every persist; re-allocating the whole home would
    // defeat the incremental dual-write fingerprint.
    const attached = attachDecisions(
      home({ recentSimulations: [sim({ id: SIM_1, lineage_id: LINEAGE_A })] })
    );
    expect(attachDecisions(attached)).toBe(attached);
  });
});

describe("groupDecisionsWithVersions", () => {
  it("lists newest decision first with its versions newest-first underneath", () => {
    const attached = attachDecisions(
      home({
        recentSimulations: [
          sim({
            id: SIM_3,
            lineage_id: LINEAGE_B,
            created_at: "2026-05-01T00:00:00.000Z",
            title: "Pricing?",
          }),
          sim({
            id: SIM_2,
            lineage_id: LINEAGE_A,
            version: 2,
            created_at: "2026-02-01T00:00:00.000Z",
            result: { chosen_future_id: "f1" },
          }),
          sim({
            id: SIM_1,
            lineage_id: LINEAGE_A,
            version: 1,
            created_at: "2026-01-01T00:00:00.000Z",
          }),
        ],
      })
    );

    const groups = groupDecisionsWithVersions(attached);

    expect(groups.map((g) => g.decision.id)).toEqual([LINEAGE_B, LINEAGE_A]);
    expect(groups[1].versions.map((v) => v.id)).toEqual([SIM_2, SIM_1]);
    expect(groups[1].status).toBe("decided");
    expect(groups[0].status).toBe("open");
  });

  it("reports the latest version as the one to open", () => {
    const attached = attachDecisions(
      home({
        recentSimulations: [
          sim({ id: SIM_2, lineage_id: LINEAGE_A, version: 2 }),
          sim({ id: SIM_1, lineage_id: LINEAGE_A, version: 1 }),
        ],
      })
    );

    expect(groupDecisionsWithVersions(attached)[0].latest.id).toBe(SIM_2);
  });
});
