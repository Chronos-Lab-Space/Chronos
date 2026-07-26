import { describe, expect, it } from "vitest";
import type { TimelineNodeRecord } from "../../domain/workspace/types";
import { orderTimelineNodesForUpsert } from "./SupabaseWorkspaceRepository";

function node(
  id: string,
  simulation_id: string,
  parent_id: string | null,
  depth: number
): TimelineNodeRecord {
  return { id, simulation_id, parent_id, title: id, depth, score: 0 };
}

/** Index of each node in the ordered output, for parent-before-child assertions. */
function positions(ordered: readonly TimelineNodeRecord[]): Map<string, number> {
  return new Map(ordered.map((n, i) => [n.id, i]));
}

describe("orderTimelineNodesForUpsert", () => {
  it("emits parents before children for FK-safe bulk upsert", () => {
    const root = node("r", "s1", null, 0);
    const child = node("c", "s1", "r", 1);
    const grand = node("g", "s1", "c", 2);

    const ordered = orderTimelineNodesForUpsert([grand, child, root]);

    expect(ordered.map((n) => n.id)).toEqual(["r", "c", "g"]);
  });

  it("keeps every parent ahead of its children when simulations are batched together", () => {
    // The batched save flattens all simulations into one upsert. Rows from
    // other simulations interleaving is fine, but a parent must never land
    // after its own child.
    const nodes = [
      node("s2-grand", "s2", "s2-child", 2),
      node("s1-child", "s1", "s1-root", 1),
      node("s2-root", "s2", null, 0),
      node("s1-grand", "s1", "s1-child", 2),
      node("s2-child", "s2", "s2-root", 1),
      node("s1-root", "s1", null, 0),
    ];

    const ordered = orderTimelineNodesForUpsert(nodes);
    const at = positions(ordered);

    expect(ordered).toHaveLength(6);
    for (const n of ordered) {
      if (n.parent_id) {
        expect(at.get(n.parent_id)!).toBeLessThan(at.get(n.id)!);
      }
    }
  });

  it("is deterministic for nodes at the same depth", () => {
    const a = node("a", "s1", null, 0);
    const b = node("b", "s2", null, 0);

    expect(orderTimelineNodesForUpsert([b, a]).map((n) => n.id)).toEqual(["a", "b"]);
    expect(orderTimelineNodesForUpsert([a, b]).map((n) => n.id)).toEqual(["a", "b"]);
  });

  it("does not mutate the input array", () => {
    const input = [node("deep", "s1", "shallow", 3), node("shallow", "s1", null, 0)];

    orderTimelineNodesForUpsert(input);

    expect(input.map((n) => n.id)).toEqual(["deep", "shallow"]);
  });

  it("returns an empty array unchanged", () => {
    expect(orderTimelineNodesForUpsert([])).toEqual([]);
  });
});
