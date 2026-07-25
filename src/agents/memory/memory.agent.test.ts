import { beforeEach, describe, expect, it } from "vitest";
import { LearningMemoryStore } from "../../infrastructure/memory/LearningMemoryStore";
import { MemoryAgent } from "./index";

describe("MemoryAgent", () => {
  const store = new LearningMemoryStore();

  beforeEach(() => {
    store.clear("w-test");
    localStorage.clear();
  });

  it("persists learning records for a ranked decision", async () => {
    const agent = new MemoryAgent(store);
    const result = await agent.execute({
      id: "t1",
      capability: "memory.write",
      input: {
        workspaceId: "w-test",
        record: {
          kind: "decision_ranked",
          simulationId: "s1",
          recommendation: "Pick lean launch",
          futures: [
            { id: "f1", name: "Lean", score: 0.82, risk: 0.2, rank: 1, expectedValue: 0.5 },
            { id: "f2", name: "Raise", score: 0.4, risk: 0.7, rank: 2 },
          ],
        },
      },
    });

    expect(result.ok).toBe(true);
    expect(result.data.written).toBe(true);
    expect(result.data.writtenCount).toBeGreaterThan(0);
    expect(store.list("w-test").length).toBeGreaterThan(0);
    expect(store.list("w-test")[0].workspaceId).toBe("w-test");
  });

  it("fails without workspaceId", async () => {
    const agent = new MemoryAgent(store);
    const result = await agent.execute({
      id: "t2",
      capability: "memory.write",
      input: { record: { simulationId: "s1" } },
    });
    expect(result.ok).toBe(false);
  });
});
