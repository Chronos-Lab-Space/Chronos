import { afterEach, describe, expect, it, vi } from "vitest";
import type { AIPort } from "../../domain/ai/AIPort";
import { NoopAIProvider } from "../../domain/ai/NoopAIProvider";
import type { GenerateRequest, GenerateResult } from "../../domain/ai/types";
import type { GoalRecord, KnowledgeRecord } from "../../domain/workspace/types";
import { extractDecisionSignals, SimulationEngine } from "./SimulationEngine";

afterEach(() => {
  vi.unstubAllEnvs();
});

const goal: GoalRecord = {
  id: "g1",
  workspace_id: "w1",
  title: "Launch CLAB on Kickstart",
  description: "Public launch",
  status: "active",
  priority: 1,
  created_at: "2026-01-01T00:00:00.000Z",
};

const knowledge: KnowledgeRecord[] = [
  {
    id: "k1",
    workspace_id: "w1",
    type: "markdown",
    title: "Kickstart brief",
    content: "Bootstrap preferred early. 10 months runway. $40k MRR.",
    metadata: {},
    created_at: "2026-01-01T00:00:00.000Z",
  },
];

describe("SimulationEngine", () => {
  const engine = new SimulationEngine(undefined, new NoopAIProvider());

  it("defaults to Noop AI and does not require a live model", () => {
    expect(engine.getAIPort().id).toBe("noop");
  });

  it("maybeEnrich is a no-op when enrich flag is off", async () => {
    vi.stubEnv("VITE_AI_SIM_ENRICH", "false");
    const out = engine.run({
      simulationId: "sim-enrich-off",
      workspaceId: "w1",
      goal,
      objective: "Should we raise funding before Kickstart?",
      knowledge,
      notes: [],
      constraints: [{ id: "c1", text: "no raise before launch", kind: "hard" }],
    });
    const enriched = await engine.maybeEnrichRecommendation(out, {
      simulationId: "sim-enrich-off",
      workspaceId: "w1",
      goal,
      objective: "Should we raise funding before Kickstart?",
      knowledge,
      notes: [],
      constraints: [{ id: "c1", text: "no raise before launch", kind: "hard" }],
    });
    expect(enriched.recommendation).toBe(out.recommendation);
    expect(enriched.best.id).toBe(out.best.id);
  });

  it("maybeEnrich rewrites recommendation when AI returns text (default enrich on)", async () => {
    vi.stubEnv("VITE_AI_SIM_ENRICH", "true");
    class FakeAI implements AIPort {
      readonly id = "fake";
      async generate(_req: GenerateRequest): Promise<GenerateResult> {
        return { text: "  AI polished recommendation.  ", model: "fake", provider: "fake" };
      }
      async embed() {
        return { vectors: [], model: "fake", provider: "fake" };
      }
      async reason(req: GenerateRequest) {
        return this.generate(req);
      }
      async code(req: GenerateRequest) {
        return this.generate(req);
      }
    }
    const withAi = new SimulationEngine(undefined, new FakeAI());
    const out = withAi.run({
      simulationId: "sim-enrich-on",
      workspaceId: "w1",
      goal,
      objective: "Should we raise funding before Kickstart?",
      knowledge,
      notes: [],
      constraints: [{ id: "c1", text: "no raise before launch", kind: "hard" }],
    });
    const enriched = await withAi.maybeEnrichRecommendation(out, {
      simulationId: "sim-enrich-on",
      workspaceId: "w1",
      goal,
      objective: "Should we raise funding before Kickstart?",
      knowledge,
      notes: [],
      constraints: [{ id: "c1", text: "no raise before launch", kind: "hard" }],
    });
    expect(enriched.recommendation).toBe("AI polished recommendation.");
    expect(enriched.best.name).toBe(out.best.name);
    expect(enriched.confidence).toBe(out.confidence);
  });

  it("runs planner → futures → evaluate → rank → best future", () => {
    const out = engine.run({
      simulationId: "sim-1",
      workspaceId: "w1",
      goal,
      objective: "Should we raise funding before Kickstart?",
      knowledge,
      notes: [],
      constraints: [
        { id: "c1", text: "no raise before launch", kind: "hard" },
        { id: "c2", text: "keep runway 12 months", kind: "soft" },
      ],
    });

    expect(out.futures.length).toBeGreaterThanOrEqual(2);
    expect(out.futures.length).toBeLessThanOrEqual(5);
    expect(out.best.name).toBe(out.futures[0].name);
    expect(out.best.score).toBeGreaterThan(0);
    expect(out.confidence).toBe(out.best.confidence);
    expect(out.recommendation.length).toBeGreaterThan(40);
    expect(out.recommendation.toLowerCase()).toMatch(
      /kickstart|raise|bootstrap|path|confidence|next/i
    );
    expect(out.futures[0].summary.length).toBeGreaterThan(out.futures[0].name.length);
    expect(out.risks.length).toBeGreaterThan(0);
    expect(out.plannerTaskTitles.length).toBeGreaterThan(0);
    expect(out.pathsEvaluated).toBeGreaterThanOrEqual(8);
    expect(out.pathArchetypes).toBeGreaterThanOrEqual(1);

    expect(out.tasks.map((t) => t.status)).toEqual([
      "completed",
      "completed",
      "completed",
      "completed",
      "completed",
    ]);
    expect(out.tasks.map((t) => t.phase)).toEqual([
      "plan",
      "generate",
      "evaluate",
      "rank",
      "collapse",
    ]);

    // Eligible futures ranked descending; ineligible (score 0) sink
    const eligible = out.futures.filter((f) => f.score > 0);
    for (let i = 1; i < eligible.length; i++) {
      expect(eligible[i - 1].score).toBeGreaterThanOrEqual(eligible[i].score);
    }

    // Cloud tables require uuid PKs — never leak demo `0x…` path ids
    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    for (const f of out.futures) {
      expect(f.id).toMatch(uuidRe);
      expect(f.id.startsWith("0x")).toBe(false);
    }
    for (const node of out.timeline) {
      expect(node.id).toMatch(uuidRe);
    }
  });

  it("disqualifies raise-heavy futures under hard no-raise constraints", () => {
    const out = engine.run({
      simulationId: "sim-hard",
      workspaceId: "w1",
      goal,
      // B2B SaaS catalog includes "Top-down enterprise" — a genuinely
      // raise-heavy path that the hard constraint must disqualify.
      objective: "Growth path for our B2B SaaS with capital options",
      knowledge,
      notes: [],
      constraints: [{ id: "c1", text: "no raise before launch", kind: "hard" }],
    });

    expect(out.best.score).toBeGreaterThan(0);
    expect(out.best.summary.toLowerCase()).not.toMatch(/infeasible/);
    // Winner should not be an obvious raise/capitalized path when hard-forbidden
    expect(out.best.name.toLowerCase()).not.toMatch(
      /capitalized scale|raise series|top-down enterprise/
    );
    // At least one raise path is actually disqualified — and never the whole catalog:
    // bootstrap-friendly paths must survive the constraint that favors them.
    const infeasible = out.futures.filter((f) => f.score === 0 || /infeasible/i.test(f.summary));
    expect(infeasible.length).toBeGreaterThanOrEqual(1);
    const eligible = out.futures.filter((f) => f.score > 0);
    expect(eligible.length).toBeGreaterThanOrEqual(2);
    for (const f of eligible) {
      expect(f.name.toLowerCase()).not.toMatch(/capitalized scale|top-down enterprise/);
    }
  });

  it("is deterministic for the same inputs", () => {
    const input = {
      simulationId: "sim-2",
      workspaceId: "w1",
      goal,
      objective: "Launch API first?",
      knowledge,
      notes: [],
      constraints: [] as const,
    };
    const a = engine.run(input);
    const b = engine.run(input);
    expect(a.futures.map((f) => f.name)).toEqual(b.futures.map((f) => f.name));
    expect(a.best.score).toBe(b.best.score);
    expect(a.confidence).toBe(b.confidence);
    expect(a.pathsEvaluated).toBe(b.pathsEvaluated);
    expect(a.recommendation).toBe(b.recommendation);
  });

  it("varies recommendation text across different objectives", () => {
    const base = {
      workspaceId: "w1",
      goal,
      knowledge,
      notes: [] as const,
      constraints: [] as const,
    };
    const a = engine.run({
      ...base,
      simulationId: "sim-obj-a",
      objective: "Should we open a enterprise sales motion for regulated buyers?",
    });
    const b = engine.run({
      ...base,
      simulationId: "sim-obj-b",
      objective: "Should we ship a free developer wedge before any sales hire?",
    });
    expect(a.recommendation).not.toBe(b.recommendation);
    expect(a.recommendation.toLowerCase()).toMatch(/enterprise|regulated|sales|compliance|trust/);
    expect(b.recommendation.toLowerCase()).toMatch(/developer|wedge|ship|partner|free/);
    // Futures are grounded in the ask, not bare catalog titles alone
    expect(a.futures.some((f) => f.summary.toLowerCase().includes("framed for"))).toBe(true);
  });

  it("salts Monte Carlo by simulationId so re-runs are not byte-identical", () => {
    const base = {
      workspaceId: "w1",
      goal,
      objective: "How should we price the private beta?",
      knowledge,
      notes: [] as const,
      constraints: [] as const,
    };
    const a = engine.run({ ...base, simulationId: "sim-salt-1" });
    const b = engine.run({ ...base, simulationId: "sim-salt-2" });
    // Names may share archetypes but summaries/recommendations should not be identical
    expect(a.recommendation === b.recommendation && a.best.score === b.best.score).toBe(false);
  });

  it("fails cleanly on empty objective", () => {
    const out = engine.run({
      simulationId: "sim-3",
      workspaceId: "w1",
      goal,
      objective: "   ",
      knowledge: [],
      notes: [],
      constraints: [],
    });
    expect(out.confidence).toBe(0);
    expect(out.tasks.some((t) => t.status === "failed")).toBe(true);
  });

  it("extracts structured runway and MRR signals from knowledge", () => {
    const signals = extractDecisionSignals(
      "Should we expand?",
      knowledge,
      [],
      [{ id: "c1", text: "no raise before launch", kind: "hard" }]
    );
    expect(signals.runwayMonths).toBe(10);
    expect(signals.mrr).toBe(40000);
    expect(signals.raiseForbidden).toBe(true);
    expect(signals.bootstrapPreferred).toBe(true);
  });
});
