import { beforeEach, describe, expect, it } from "vitest";
import type { LearningMemoryRecord } from "../../domain/workspace/productLearning";
import { LearningMemoryStore } from "./LearningMemoryStore";

function record(partial: Partial<LearningMemoryRecord> = {}): LearningMemoryRecord {
  return {
    id: "r1",
    workspaceId: "ws-1",
    kind: "preference",
    content: "Prefers bootstrap paths over raising",
    metadata: {},
    simulationId: "sim-1",
    createdAt: "2026-08-01T00:00:00.000Z",
    ...partial,
  };
}

describe("LearningMemoryStore — cloud write is opt-in, not env-inferred", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("commits locally with no cloud writer injected — the anonymous-workspace default", () => {
    // The structural guarantee under test: append() takes no cloud dependency
    // unless one is passed at construction, so there is no code path here
    // that could reach Supabase.
    const store = new LearningMemoryStore();
    store.append("ws-1", [record()]);
    expect(store.list("ws-1")).toHaveLength(1);
  });

  it("dual-writes through the injected cloud writer when one is given", async () => {
    const upserted: unknown[] = [];
    const store = new LearningMemoryStore({
      upsertKnowledge: async (rows) => {
        upserted.push(...rows);
        return { error: null };
      },
    });
    store.append("ws-1", [record()]);
    // append() fires the dual-write without awaiting it (best-effort); flush microtasks.
    await Promise.resolve();
    await Promise.resolve();
    expect(upserted).toHaveLength(1);
  });

  it("still commits locally when the injected cloud writer fails", async () => {
    const store = new LearningMemoryStore({
      upsertKnowledge: async () => ({ error: { message: "RLS denied" } }),
    });
    store.append("ws-1", [record()]);
    expect(store.list("ws-1")).toHaveLength(1);
  });
});
