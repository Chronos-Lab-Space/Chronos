import { describe, expect, it } from "vitest";
import { layoutFutureGraph } from "./futureGraph";
import type { FutureRecord } from "./types";

function future(id: string, name: string, score: number, risk = 0.3): FutureRecord {
  return { id, simulation_id: "s1", name, score, risk, confidence: score, summary: "" };
}

describe("layoutFutureGraph", () => {
  it("returns null with no futures", () => {
    expect(layoutFutureGraph([])).toBeNull();
  });

  it("ranks best-first top-to-bottom and centers the root", () => {
    const layout = layoutFutureGraph([
      future("b", "Beta", 0.5),
      future("a", "Alpha", 0.9),
      future("c", "Gamma", 0.7),
    ]);
    expect(layout?.nodes.map((n) => n.name)).toEqual(["Alpha", "Gamma", "Beta"]);
    const first = layout!.nodes[0]!;
    const last = layout!.nodes[2]!;
    expect(first.y).toBeLessThan(last.y);
    expect(layout!.root.y).toBe(Math.round((first.y + last.y) / 2));
  });

  it("height grows with the number of branches", () => {
    const three = layoutFutureGraph([
      future("a", "A", 0.9),
      future("b", "B", 0.8),
      future("c", "C", 0.7),
    ]);
    const five = layoutFutureGraph([
      future("a", "A", 0.9),
      future("b", "B", 0.8),
      future("c", "C", 0.7),
      future("d", "D", 0.6),
      future("e", "E", 0.5),
    ]);
    expect(five!.height).toBeGreaterThan(three!.height);
  });

  it("flags recommended by best_future name, else the top score", () => {
    const futures = [future("a", "Alpha", 0.9), future("b", "Beta", 0.8)];
    const byName = layoutFutureGraph(futures, { bestName: "Beta" });
    expect(byName?.nodes.find((n) => n.id === "b")?.recommended).toBe(true);
    expect(byName?.nodes.find((n) => n.id === "a")?.recommended).toBe(false);

    const byRank = layoutFutureGraph(futures);
    expect(byRank?.nodes.find((n) => n.id === "a")?.recommended).toBe(true);
  });

  it("marks the chosen branch and rounds percentages", () => {
    const layout = layoutFutureGraph([future("a", "Alpha", 0.876, 0.414)], { chosenId: "a" });
    const node = layout!.nodes[0]!;
    expect(node.chosen).toBe(true);
    expect(node.scorePct).toBe(88);
    expect(node.riskPct).toBe(41);
    expect(node.tail.label).toBe("RISK 41%");
  });
});
