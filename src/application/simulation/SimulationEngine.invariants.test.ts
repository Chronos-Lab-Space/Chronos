/** Simulation engine invariants — beta-readiness guarantees (ranking, bounds, determinism, constraint disqualification, adversarial input). */
import { describe, expect, it } from "vitest";
import { SimulationEngine } from "./SimulationEngine";

const UUID = "11111111-1111-4111-8111-111111111111";
const WS = "22222222-2222-4222-8222-222222222222";

function input(objective: string, constraints: { text: string; kind: "hard" | "soft" }[] = []) {
  return {
    simulationId: UUID,
    workspaceId: WS,
    goal: null,
    objective,
    knowledge: [],
    notes: [],
    constraints: constraints.map((c, i) => ({ id: `c${i}`, ...c })),
  };
}

describe("beta sanity: SimulationEngine invariants", () => {
  const engine = new SimulationEngine();

  it("produces ranked futures with sane bounds", () => {
    const out = engine.run(
      input("Should we launch the public beta with a small team? 12 months runway, $8k MRR")
    );
    expect(out.futures.length).toBeGreaterThanOrEqual(3);
    expect(out.best.id).toBe(out.futures[0].id);
    for (const f of out.futures) {
      expect(f.score).toBeGreaterThanOrEqual(0);
      expect(f.score).toBeLessThanOrEqual(1);
      expect(f.risk).toBeGreaterThanOrEqual(0);
      expect(f.risk).toBeLessThanOrEqual(1);
      expect(f.confidence).toBeGreaterThanOrEqual(0);
      expect(f.confidence).toBeLessThanOrEqual(1);
      expect(f.name.length).toBeGreaterThan(0);
      expect(f.summary.length).toBeGreaterThan(0);
    }
    expect(out.confidence).toBeGreaterThanOrEqual(0);
    expect(out.confidence).toBeLessThanOrEqual(1);
    expect(out.pathsEvaluated).toBeGreaterThan(0);
    expect(out.recommendation.length).toBeGreaterThan(0);
    expect(out.risks.length).toBeGreaterThan(0);
    expect(out.tasks.every((t) => t.status === "completed")).toBe(true);
    expect(out.timeline.length).toBeGreaterThan(0);
  });

  it("ranks eligible futures by descending score", () => {
    const out = engine.run(input("How do we grow to $50k MRR without hiring?"));
    const scores = out.futures.map((f) => f.score);
    const sorted = [...scores].sort((a, b) => b - a);
    // Eligible-first ordering: at minimum the top future carries the max score
    expect(out.futures[0].score).toBe(Math.max(...scores));
    // and overall ordering should be non-increasing
    expect(scores).toEqual(sorted);
  });

  it("hard 'no raise' constraint disqualifies raise-heavy paths from the top pick", () => {
    const base = input("Should we raise a Series A to accelerate enterprise sales?");
    const constrained = engine.run({
      ...base,
      constraints: [{ id: "c0", text: "never raise funding before launch", kind: "hard" }],
    });
    expect(constrained.best.name.toLowerCase()).not.toMatch(/raise|series|fund|venture/);
    const unconstrained = engine.run(base);
    expect(unconstrained.pathsEvaluated).toBeGreaterThan(0);
  });

  it("is deterministic for identical input", () => {
    const a = engine.run(input("Launch on Kickstart with 12 month runway, burn $10k"));
    const b = engine.run(input("Launch on Kickstart with 12 month runway, burn $10k"));
    expect(a.futures.map((f) => [f.name, f.score, f.risk])).toEqual(
      b.futures.map((f) => [f.name, f.score, f.risk])
    );
    expect(a.recommendation).toBe(b.recommendation);
    expect(a.confidence).toBe(b.confidence);
  });

  it("keeps bootstrap-friendly paths eligible under a hard bootstrap constraint", () => {
    const out = engine.run({
      ...input("How should we grow our B2B SaaS to $50k MRR?"),
      constraints: [{ id: "c0", text: "No raise, must bootstrap", kind: "hard" }],
    });
    const byName = (re: RegExp) => out.futures.find((f) => re.test(f.name));
    const wedge = byName(/bootstrap wedge/i);
    const bottomUp = byName(/bottom-up/i);
    const topDown = byName(/top-down/i);
    // The paths that SATISFY the constraint must stay eligible…
    expect(wedge?.score ?? 0).toBeGreaterThan(0);
    expect(bottomUp?.score ?? 0).toBeGreaterThan(0);
    // …while genuinely raise-heavy paths are the ones disqualified.
    if (topDown) expect(topDown.score).toBe(0);
    expect(out.disqualifiedCount).toBeLessThan(out.futures.length - 1);
  });

  it("does not kill a growth objective under a bootstrap constraint", () => {
    const out = engine.run({
      ...input("Aggressively scale our product and win the market this year"),
      constraints: [{ id: "c0", text: "No raise, must bootstrap", kind: "hard" }],
    });
    expect(out.futures.some((f) => f.score > 0)).toBe(true);
    expect(out.confidence).toBeGreaterThan(0);
    expect(out.recommendation.toLowerCase()).not.toContain("violated hard constraints");
  });

  it("does not disqualify the compliance-ready health path under a HIPAA constraint", () => {
    const out = engine.run({
      ...input("Patient documentation platform for medical clinics"),
      constraints: [{ id: "c0", text: "Must be HIPAA compliant from day one", kind: "hard" }],
    });
    const clinical = out.futures.find((f) => /clinical/i.test(f.name));
    // The health archetype's own milestones include "HIPAA + SOC 2".
    expect(clinical?.score ?? 0).toBeGreaterThan(0);
  });

  it("fails cleanly on empty objective and survives adversarial input", () => {
    const empty = engine.run(input("   "));
    expect(empty.tasks.some((t) => t.status === "failed")).toBe(true);

    const weird = engine.run(
      input("🚀".repeat(500) + ' <script>alert(1)</script> "; DROP TABLE futures; --')
    );
    expect(weird.futures.length).toBeGreaterThan(0);
    expect(weird.best.score).toBeGreaterThanOrEqual(0);
  });
});
