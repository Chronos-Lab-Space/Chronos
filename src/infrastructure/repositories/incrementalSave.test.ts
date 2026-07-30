import { describe, expect, it, vi } from "vitest";
import type {
  FutureRecord,
  GoalRecord,
  SimulationRecord,
  TimelineNodeRecord,
  WorkspaceHome,
} from "../../domain/workspace/types";
import { SupabaseWorkspaceRepository } from "./SupabaseWorkspaceRepository";

/**
 * `save_workspace_home` upserts and never deletes — every collection is read
 * as `coalesce(payload -> 'x', '[]')`, so an absent collection means "leave
 * those rows alone", not "remove them". That is what makes it safe to send
 * only what changed.
 *
 * It matters because every mutation went through one whole-workspace write:
 * adding a note rewrote every simulation, future, and timeline node. On the
 * hosted project that produced ~44k row updates to maintain ~600 rows, with
 * `timeline_nodes` rewritten 60 times per row.
 */

const workspace = {
  id: "w1",
  owner_id: "u1",
  name: "Lab",
  description: "",
  created_at: "2026-01-01T00:00:00.000Z",
};

const goal: GoalRecord = {
  id: "g1",
  workspace_id: "w1",
  title: "ship it",
  description: "",
  status: "active",
  priority: 1,
  created_at: "2026-01-01T00:00:00.000Z",
};

const simulation: SimulationRecord = {
  id: "s1",
  workspace_id: "w1",
  goal_id: "g1",
  title: "run",
  status: "completed",
  confidence: 0.8,
  result: {},
  created_at: "2026-01-01T00:00:00.000Z",
  version: 1,
  lineage_id: "L1",
  parent_simulation_id: null,
};

const future: FutureRecord = {
  id: "f1",
  simulation_id: "s1",
  name: "Path A",
  score: 0.9,
  risk: 0.2,
  confidence: 0.8,
  summary: "",
};

const node: TimelineNodeRecord = {
  id: "t1",
  simulation_id: "s1",
  parent_id: null,
  title: "N0",
  depth: 0,
  score: 0.9,
};

function home(overrides: Partial<WorkspaceHome> = {}): WorkspaceHome {
  return {
    workspace,
    goal,
    goalHistory: [],
    recentSimulations: [simulation],
    knowledge: [],
    notes: [],
    futuresBySimulation: { s1: [future] },
    timelineBySimulation: { s1: [node] },
    ...overrides,
  };
}

function repoWith(rpc: ReturnType<typeof vi.fn>) {
  return new SupabaseWorkspaceRepository({ rpc } as never);
}

function payloadOf(rpc: ReturnType<typeof vi.fn>, call: number): Record<string, unknown> {
  return (rpc.mock.calls[call] as unknown as [string, { payload: Record<string, unknown> }])[1]
    .payload;
}

describe("incremental dual-write", () => {
  it("sends every collection on the first save", async () => {
    const rpc = vi.fn(async () => ({ error: null }));
    await repoWith(rpc).save(home());

    expect(rpc).toHaveBeenCalledTimes(1);
    const payload = payloadOf(rpc, 0);
    expect(Object.keys(payload).sort()).toEqual([
      "futures",
      "goal",
      "knowledge",
      "notes",
      "simulations",
      "timeline_nodes",
      "workspace",
    ]);
  });

  it("skips the round trip entirely when nothing changed", async () => {
    const rpc = vi.fn(async () => ({ error: null }));
    const repo = repoWith(rpc);

    await repo.save(home());
    await repo.save(home());

    // The second save is the common case: WorkspaceService.persist() runs on
    // read-repair and load write-through, not only on real edits.
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it("sends only what changed when one note is added", async () => {
    const rpc = vi.fn(async () => ({ error: null }));
    const repo = repoWith(rpc);

    await repo.save(home());
    await repo.save(
      home({
        notes: [
          {
            id: "n1",
            workspace_id: "w1",
            title: "Runway",
            content: "10 months",
            created_at: "2026-01-02T00:00:00.000Z",
          },
        ],
      })
    );

    expect(rpc).toHaveBeenCalledTimes(2);
    const payload = payloadOf(rpc, 1);
    expect(payload).toHaveProperty("notes");
    // The expensive ones must not be rewritten just because a note appeared.
    expect(payload).not.toHaveProperty("simulations");
    expect(payload).not.toHaveProperty("futures");
    expect(payload).not.toHaveProperty("timeline_nodes");
  });

  it("always carries the workspace, which the RPC reads unconditionally", async () => {
    const rpc = vi.fn(async () => ({ error: null }));
    const repo = repoWith(rpc);

    await repo.save(home());
    await repo.save(
      home({
        notes: [],
        knowledge: [
          {
            id: "k1",
            workspace_id: "w1",
            type: "note",
            title: "Brief",
            content: "x",
            metadata: {},
            created_at: "2026-01-02T00:00:00.000Z",
          },
        ],
      })
    );

    // jsonb_to_record(payload -> 'workspace') is not coalesced in the SQL,
    // so omitting it would be an error rather than a no-op.
    expect(payloadOf(rpc, 1)).toHaveProperty("workspace");
  });

  it("re-sends everything after a failed save", async () => {
    // A rejected write must not be remembered as written, or the next save
    // would omit rows the cloud never received — silent divergence, which
    // persist() would swallow because it catches and keeps the local copy.
    const rpc = vi
      .fn()
      .mockResolvedValueOnce({ error: { message: "network down" } })
      .mockResolvedValue({ error: null });
    const repo = repoWith(rpc);

    await expect(repo.save(home())).rejects.toBeTruthy();
    await repo.save(home());

    expect(rpc).toHaveBeenCalledTimes(2);
    expect(Object.keys(payloadOf(rpc, 1)).sort()).toEqual([
      "futures",
      "goal",
      "knowledge",
      "notes",
      "simulations",
      "timeline_nodes",
      "workspace",
    ]);
  });

  it("tracks each workspace separately", async () => {
    const rpc = vi.fn(async () => ({ error: null }));
    const repo = repoWith(rpc);
    const other = { ...workspace, id: "w2", name: "Other" };

    await repo.save(home());
    await repo.save(home({ workspace: other }));

    // A second workspace has never been written, so it gets a full payload
    // rather than inheriting w1's snapshot.
    expect(rpc).toHaveBeenCalledTimes(2);
    expect(payloadOf(rpc, 1)).toHaveProperty("simulations");
  });
});
