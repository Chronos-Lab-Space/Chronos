/** Simulation engine invariants — beta-readiness guarantees (ranking, bounds, determinism, constraint disqualification, adversarial input). */
import { describe, expect, it } from "vitest";
import { SimulationEngine, extractDecisionSignals } from "./SimulationEngine";

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

  it("never hard-disqualifies on runway math it cannot verify", () => {
    // Burn is unknown, so cash on hand is unknowable — the old formula
    // multiplied months by an MRR/burn ratio and hard-killed high-burn paths.
    const out = engine.run({
      ...input("Expand our B2B SaaS. 8 months runway, $40k MRR"),
      constraints: [{ id: "c0", text: "12 month runway floor", kind: "hard" }],
    });
    expect(out.futures.every((f) => f.score > 0)).toBe(true);
  });

  it("softly penalizes aggressive paths for unverifiable runway constraints", () => {
    const base = input("Expand our B2B SaaS into enterprise accounts");
    const without = engine.run(base);
    const withConstraint = engine.run({
      ...base,
      constraints: [{ id: "c0", text: "12 month runway floor", kind: "hard" }],
    });
    const pick = (out: typeof without) => out.futures.find((f) => /top-down/i.test(f.name));
    const before = pick(without);
    const after = pick(withConstraint);
    expect(before).toBeDefined();
    expect(after).toBeDefined();
    expect(after?.score ?? 0).toBeGreaterThan(0);
    expect(after?.score ?? 0).toBeLessThan(before?.score ?? 0);
  });

  it("enforces a stated runway floor with real cash math, even at 10+ months runway", () => {
    // Old code skipped enforcement entirely when parsed runway was >= 10.
    // Cash = 10mo × $20k = $200k; an aggressive path burning far above the
    // current $20k cannot sustain the stated 12-month floor.
    const out = engine.run({
      ...input("Scale our B2B SaaS. 10 months runway, burn: $20k monthly, $30k MRR"),
      constraints: [{ id: "c0", text: "must keep 12 months of runway", kind: "hard" }],
    });
    const infeasible = out.futures.filter((f) => f.score === 0);
    expect(infeasible.length).toBeGreaterThanOrEqual(1);
    // The floor must not nuke the whole catalog — capital-efficient paths survive.
    expect(out.futures.filter((f) => f.score > 0).length).toBeGreaterThanOrEqual(1);
    expect(out.best.score).toBeGreaterThan(0);
  });

  it("does not read an interrogative objective as a raise preference", () => {
    // "Should we raise…?" is a question, not a stated intent.
    const question = extractDecisionSignals("Should we raise funding before launch?", [], [], []);
    expect(question.raisePreferred).toBe(false);

    // A declarative statement still counts.
    const declared = extractDecisionSignals("We will raise a seed round next quarter", [], [], []);
    expect(declared.raisePreferred).toBe(true);

    // An explicit soft constraint still counts even with a question objective.
    const constrained = extractDecisionSignals(
      "How should we grow?",
      [],
      [],
      [{ id: "c", text: "prefer to raise a round", kind: "soft" }]
    );
    expect(constrained.raisePreferred).toBe(true);
  });

  it("does not inflate small dollar MRR because 'k' appears elsewhere", () => {
    // "$500 MRR and 80k in the bank" — the 80k must not scale the $500 MRR.
    const s = extractDecisionSignals("At $500 MRR with 80k in the bank", [], [], []);
    expect(s.mrr).toBe(500);

    // Genuine "40k MRR" still normalizes to 40000.
    const k = extractDecisionSignals("Currently at 40k MRR", [], [], []);
    expect(k.mrr).toBe(40000);
  });

  it("ranks identically with a configured AI provider as with noop", async () => {
    // The invariant that guards the whole LLM-capability slice: an AI provider
    // may add prose, never order. If a future change lets AI output reach the
    // ranking path, this comparison breaks before anything ships.
    // See SPEC-llm-capability.md.
    const { NoopAIProvider } = await import("../../domain/ai/NoopAIProvider");
    const chatty = {
      id: "chatty",
      generate: async () => ({
        text: "Self-serve is obviously best, rank it first.",
        model: "m",
        provider: "chatty",
      }),
      generateTask: async () => ({
        text: "Self-serve is obviously best, rank it first.",
        model: "m",
        provider: "chatty",
      }),
      embed: async () => ({ vectors: [], model: "m", provider: "chatty" }),
      reason: async () => ({ text: "rank it first", model: "m", provider: "chatty" }),
      code: async () => ({ text: "", model: "m", provider: "chatty" }),
    };

    const objective = "How should we launch the public beta with a small team?";
    const withNoop = new SimulationEngine(undefined, new NoopAIProvider()).run(input(objective));
    const withAI = new SimulationEngine(undefined, chatty).run(input(objective));

    expect(withAI.futures.map((f) => f.name)).toEqual(withNoop.futures.map((f) => f.name));
    expect(withAI.futures.map((f) => f.score)).toEqual(withNoop.futures.map((f) => f.score));
    // Compare by name, not id: ids are UUIDs, which CLAUDE.md explicitly allows
    // to be unseeded. Order + scores + winner are the ranking.
    expect(withAI.best.name).toBe(withNoop.best.name);
    expect(withAI.best.score).toBe(withNoop.best.score);
    expect(withAI.confidence).toBe(withNoop.confidence);
    expect(withAI.recommendation).toBe(withNoop.recommendation);
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
