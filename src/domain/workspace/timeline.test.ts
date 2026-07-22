import { describe, expect, it } from "vitest";
import {
  deriveFutureHooks,
  deriveNextSteps,
  futureCardLabel,
  futureHookFor,
} from "./timeline";
import type { FutureRecord } from "./types";

const future = (overrides: Partial<FutureRecord> = {}): FutureRecord => ({
  id: "f1",
  simulation_id: "s1",
  name: "Bootstrap",
  score: 0.8,
  risk: 0.3,
  confidence: 0.82,
  summary: "Stay capital efficient until product-market fit.",
  ...overrides,
});

describe("timeline cards helpers", () => {
  it("labels futures A–E", () => {
    expect(futureCardLabel(0)).toBe("A");
    expect(futureCardLabel(3)).toBe("D");
  });

  it("derives next steps for best and alternate futures", () => {
    const best = deriveNextSteps(future(), true);
    expect(best[0]).toMatch(/primary recommendation/i);
    expect(best.length).toBeGreaterThanOrEqual(3);

    const alt = deriveNextSteps(future({ risk: 0.7, confidence: 0.4 }), false);
    expect(alt[0]).toMatch(/Compare/i);
    expect(alt.some((s) => /risk/i.test(s))).toBe(true);
  });

  it("assigns exclusive wow hooks: Fastest path · Lower risk · Highest upside", () => {
    const futures: FutureRecord[] = [
      future({
        id: "a",
        name: "Ship fast",
        confidence: 0.92,
        risk: 0.4,
        score: 0.75,
      }),
      future({
        id: "b",
        name: "Safe bet",
        confidence: 0.7,
        risk: 0.12,
        score: 0.65,
      }),
      future({
        id: "c",
        name: "Moonshot",
        confidence: 0.55,
        risk: 0.55,
        score: 0.95,
      }),
    ];

    const hooks = deriveFutureHooks(futures);
    expect(futureHookFor("a", hooks)).toBe("Fastest path");
    expect(futureHookFor("b", hooks)).toBe("Lower risk");
    expect(futureHookFor("c", hooks)).toBe("Highest upside");

    // roles are exclusive
    const labels = [...hooks.values()];
    expect(new Set(labels).size).toBe(labels.length);
  });

  it("handles a single future as Fastest path", () => {
    const hooks = deriveFutureHooks([future({ id: "only", confidence: 0.8 })]);
    expect(hooks.get("only")).toBe("Fastest path");
    expect(hooks.size).toBe(1);
  });
});
