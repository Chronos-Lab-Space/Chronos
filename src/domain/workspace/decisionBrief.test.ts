import { describe, expect, it } from "vitest";
import { deriveDecisionBrief } from "./decisionBrief";
import type { FutureRecord, SimulationRecord, WorkspaceHome } from "./types";

function home(overrides: {
  goal?: boolean;
  sims?: SimulationRecord[];
  futures?: Record<string, FutureRecord[]>;
  knowledge?: WorkspaceHome["knowledge"];
}): WorkspaceHome {
  return {
    workspace: {
      id: "w1",
      owner_id: "u1",
      name: "Lab",
      description: "",
      created_at: "2026-01-01T00:00:00.000Z",
    },
    goal:
      overrides.goal === false
        ? null
        : {
            id: "g1",
            workspace_id: "w1",
            title: "Launch CLAB Public Beta",
            description: "Ship invite-only",
            status: "active",
            priority: 1,
            created_at: "2026-01-02T00:00:00.000Z",
          },
    goalHistory: [],
    decisions: [],
    recentSimulations: overrides.sims ?? [],
    knowledge: overrides.knowledge ?? [],
    notes: [],
    futuresBySimulation: overrides.futures ?? {},
    timelineBySimulation: {},
  };
}

function sim(
  partial: Partial<SimulationRecord> & Pick<SimulationRecord, "id" | "status">
): SimulationRecord {
  return {
    workspace_id: "w1",
    goal_id: "g1",
    title: "How should we launch?",
    confidence: 0.72,
    result: {
      best_future: "Community first",
      recommendation: "Open to the community list first.",
    },
    created_at: "2026-01-03T00:00:00.000Z",
    version: 1,
    lineage_id: partial.id,
    parent_simulation_id: null,
    ...partial,
  };
}

const futures: FutureRecord[] = [
  {
    id: "f2",
    simulation_id: "s1",
    name: "Big bang launch",
    score: 0.61,
    risk: 0.55,
    confidence: 0.61,
    summary: "Go wide now",
  },
  {
    id: "f1",
    simulation_id: "s1",
    name: "Community first",
    score: 0.72,
    risk: 0.2,
    confidence: 0.72,
    summary: "Staged opening",
  },
];

/** A workspace whose single knowledge source landed at `addedAt`. */
function homeWithKnowledge(addedAt: string): WorkspaceHome {
  const base = home({});
  return {
    ...base,
    knowledge: [
      {
        id: "k1",
        workspace_id: "w1",
        type: "markdown",
        title: "Roadmap",
        content: "",
        metadata: {},
        created_at: addedAt,
      },
    ],
  };
}

describe("deriveDecisionBrief", () => {
  it("returns null without a home", () => {
    expect(deriveDecisionBrief(null)).toBeNull();
  });

  it("draft: goal but no simulations — no recommendation, no invented numbers", () => {
    const brief = deriveDecisionBrief(home({}));
    expect(brief?.stageId).toBe("draft");
    expect(brief?.recommendation).toBeNull();
    expect(brief?.confidencePct).toBeNull();
    expect(brief?.futures).toEqual([]);
    expect(brief?.stages.map((s) => s.state)).toEqual([
      "current",
      "ahead",
      "ahead",
      "ahead",
      "ahead",
      "ahead",
    ]);
  });

  it("simulating while the latest run is queued or running", () => {
    const brief = deriveDecisionBrief(home({ sims: [sim({ id: "s1", status: "running" })] }));
    expect(brief?.stageId).toBe("simulating");
  });

  it("prefers AI-written body prose over the deterministic thesis", () => {
    const brief = deriveDecisionBrief(
      home({
        sims: [
          sim({
            id: "s1",
            status: "completed",
            result: {
              best_future: "Community first",
              recommendation: "Open to the community list first.",
              thesis: "Deterministic thesis.",
              recommendation_body: "It beats the big-bang launch on speed to first signal.",
            },
          }),
        ],
        futures: { s1: futures },
      })
    );
    expect(brief?.recommendation?.body).toBe(
      "It beats the big-bang launch on speed to first signal."
    );
  });

  it("falls back to the thesis for runs that predate AI body prose", () => {
    const brief = deriveDecisionBrief(
      home({
        sims: [
          sim({
            id: "s1",
            status: "completed",
            result: {
              best_future: "Community first",
              recommendation: "Open to the community list first.",
              thesis: "Deterministic thesis.",
            },
          }),
        ],
        futures: { s1: futures },
      })
    );
    expect(brief?.recommendation?.body).toBe("Deterministic thesis.");
  });

  it("evaluating: completed run ranks futures best-first with the engine pick flagged", () => {
    const brief = deriveDecisionBrief(
      home({ sims: [sim({ id: "s1", status: "completed" })], futures: { s1: futures } })
    );
    expect(brief?.stageId).toBe("evaluating");
    expect(brief?.confidencePct).toBe(72);
    expect(brief?.recommendation?.headline).toBe("Open to the community list first.");
    expect(brief?.futures.map((f) => f.name)).toEqual(["Community first", "Big bang launch"]);
    expect(brief?.futures[0]).toMatchObject({ scorePct: 72, recommended: true, chosen: false });
  });

  it("collapsed → observed → learned as outcome fields land", () => {
    const collapsed = deriveDecisionBrief(
      home({
        sims: [
          sim({
            id: "s1",
            status: "completed",
            result: { best_future: "Community first", chosen_future_id: "f1" },
          }),
        ],
        futures: { s1: futures },
      })
    );
    expect(collapsed?.stageId).toBe("collapsed");
    expect(collapsed?.futures.find((f) => f.id === "f1")?.chosen).toBe(true);

    const observed = deriveDecisionBrief(
      home({
        sims: [
          sim({
            id: "s1",
            status: "completed",
            result: { chosen_future_id: "f1", outcome_followed: "yes" },
          }),
        ],
      })
    );
    expect(observed?.stageId).toBe("observed");

    const learned = deriveDecisionBrief(
      home({
        sims: [
          sim({
            id: "s1",
            status: "completed",
            result: {
              chosen_future_id: "f1",
              outcome_followed: "yes",
              outcome_result: "Shipped; retention healthy.",
            },
          }),
        ],
      })
    );
    expect(learned?.stageId).toBe("learned");
    expect(learned?.stages.map((s) => s.state)).toEqual([
      "past",
      "past",
      "past",
      "past",
      "past",
      "current",
    ]);
  });

  it("a failed run with no completed report stays in draft", () => {
    const brief = deriveDecisionBrief(home({ sims: [sim({ id: "s1", status: "failed" })] }));
    expect(brief?.stageId).toBe("draft");
    expect(brief?.recommendation).toBeNull();
  });

  it("says how far behind the leader each ranked future is", () => {
    // The design's ranked list explains why a path lost, not just that it did.
    const brief = deriveDecisionBrief(
      home({ sims: [sim({ id: "s1", status: "completed" })], futures: { s1: futures } })
    );

    expect(brief?.futures.map((f) => f.standing)).toEqual([null, { kind: "behind", points: 11 }]);
  });

  it("weights each evidence row by how many runs actually used it", () => {
    // The design weighted sources HIGH/MEDIUM, which nothing in the schema
    // backs. Use counts the workspace really recorded instead.
    const knowledge = [
      {
        id: "k1",
        workspace_id: "w1",
        type: "markdown" as const,
        title: "Roadmap",
        content: "",
        metadata: {},
        created_at: "2026-01-05T00:00:00.000Z",
      },
      {
        id: "k2",
        workspace_id: "w1",
        type: "markdown" as const,
        title: "Press list",
        content: "",
        metadata: {},
        created_at: "2026-01-04T00:00:00.000Z",
      },
    ];
    const cite = (...ids: string[]) => ({
      knowledge_used: ids.map((id) => ({ id, title: id, type: "document" })),
    });
    const brief = deriveDecisionBrief(
      home({
        knowledge,
        sims: [
          sim({ id: "s2", status: "completed", result: cite("k1") }),
          sim({ id: "s1", status: "completed", result: cite("k1", "k2") }),
        ],
      })
    );

    expect(brief?.evidence.map((e) => [e.id, e.citedByRuns])).toEqual([
      ["k1", 2],
      ["k2", 1],
    ]);
  });

  it("counts the futures hard constraints ruled out", () => {
    const brief = deriveDecisionBrief(
      home({
        sims: [sim({ id: "s1", status: "completed", result: { disqualified_count: 3 } })],
      })
    );

    expect(brief?.stats.find((s) => s.label === "RULED OUT")?.value).toBe("3");
  });

  it("measures staleness from the newest input, not from the run", () => {
    const brief = deriveDecisionBrief(
      homeWithKnowledge("2026-01-08T00:00:00.000Z"),
      new Date("2026-01-10T00:00:00.000Z")
    );

    expect(brief?.stats.find((s) => s.label === "STALENESS")?.value).toBe("2d");
  });

  it("reports staleness as today when input landed within the day", () => {
    const brief = deriveDecisionBrief(
      homeWithKnowledge("2026-01-10T06:00:00.000Z"),
      new Date("2026-01-10T18:00:00.000Z")
    );

    expect(brief?.stats.find((s) => s.label === "STALENESS")?.value).toBe("today");
  });

  it("has no staleness to report before anything has been attached", () => {
    const brief = deriveDecisionBrief(home({}), new Date("2026-01-10T00:00:00.000Z"));

    expect(brief?.stats.find((s) => s.label === "STALENESS")?.value).toBe("—");
  });

  it("never reports the top-ranked future as behind itself", () => {
    // best_future can name a path that is not in the stored futures — a rename
    // between runs is enough. Nothing is then flagged `recommended`, and the
    // leader must still not be measured against its own score.
    const brief = deriveDecisionBrief(
      home({
        sims: [
          sim({ id: "s1", status: "completed", result: { best_future: "A path since renamed" } }),
        ],
        futures: { s1: futures },
      })
    );

    expect(brief?.futures[0].standing).toBeNull();
  });

  it("marks a future the engine disqualified rather than calling it merely behind", () => {
    // SimulationEngine ranks constraint-violating paths last with score <= 0
    // and still ships them; a bare "0%" hides that a constraint killed it.
    const disqualified: FutureRecord[] = [
      ...futures,
      {
        id: "f3",
        simulation_id: "s1",
        name: "Raise a round first",
        score: 0,
        risk: 0.9,
        confidence: 0.1,
        summary: "Violates the no-raise constraint",
      },
    ];
    const brief = deriveDecisionBrief(
      home({ sims: [sim({ id: "s1", status: "completed" })], futures: { s1: disqualified } })
    );

    expect(brief?.futures.at(-1)?.standing).toEqual({ kind: "disqualified" });
  });

  it("recommendation and futures come from the newest completed run, not a newer failed one", () => {
    const brief = deriveDecisionBrief(
      home({
        sims: [
          sim({ id: "s2", status: "failed", created_at: "2026-01-04T00:00:00.000Z" }),
          sim({ id: "s1", status: "completed" }),
        ],
        futures: { s1: futures },
      })
    );
    expect(brief?.stageId).toBe("evaluating");
    expect(brief?.reportSimulation?.id).toBe("s1");
    expect(brief?.futures).toHaveLength(2);
  });
});
