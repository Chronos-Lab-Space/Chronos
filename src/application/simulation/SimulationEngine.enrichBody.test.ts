import { describe, expect, it } from "vitest";
import type { AIPort } from "../../domain/ai/AIPort";
import type { GenerateResult } from "../../domain/ai/types";
import type { GoalRecord } from "../../domain/workspace/types";
import { SimulationEngine, type SimulationEngineInput } from "./SimulationEngine";

/**
 * The model was only ever allowed to rewrite the headline. The brief's body —
 * the block people actually read — came from the deterministic thesis, so a
 * successful AI call barely changed what the page looked like.
 *
 * It now writes both. Everything numeric is still settled before the port is
 * consulted: futures, scores, ranking and confidence are computed by `run`.
 */

const goal: GoalRecord = {
  id: "g1",
  workspace_id: "w1",
  title: "Launch the public beta",
  description: "",
  status: "active",
  priority: 1,
  created_at: "2026-01-01T00:00:00.000Z",
};

const input: SimulationEngineInput = {
  simulationId: "sim-body",
  workspaceId: "w1",
  goal,
  objective: "Should we raise funding before launch?",
  knowledge: [],
  notes: [],
  constraints: [],
};

function engineReturning(text: string) {
  class FakeAI implements AIPort {
    readonly id = "fake";
    async generate(): Promise<GenerateResult> {
      return { text, model: "fake", provider: "fake" };
    }
    async embed() {
      return { vectors: [], model: "fake", provider: "fake" };
    }
    async reason() {
      return this.generate();
    }
    async code() {
      return this.generate();
    }
  }
  return new SimulationEngine(undefined, new FakeAI());
}

describe("AI-written brief body", () => {
  it("splits a headline and a body on the blank line", async () => {
    const engine = engineReturning(
      "  Raise now, on the strength of the design partners.  \n\n" +
        "The bottom-up path reaches revenue sooner but caps out lower. " +
        "Validate with five partners before committing spend."
    );
    const out = engine.run(input);

    const enriched = await engine.maybeEnrichRecommendation(out, input);

    expect(enriched.recommendation).toBe("Raise now, on the strength of the design partners.");
    expect(enriched.recommendationBody).toBe(
      "The bottom-up path reaches revenue sooner but caps out lower. " +
        "Validate with five partners before committing spend."
    );
  });

  it("leaves the body alone when the model returns a single block", async () => {
    // Older prompts, smaller models, and refusals all produce one block.
    // That must keep working rather than swallowing the whole answer.
    const engine = engineReturning("Raise now, on the strength of the design partners.");
    const out = engine.run(input);

    const enriched = await engine.maybeEnrichRecommendation(out, input);

    expect(enriched.recommendation).toBe("Raise now, on the strength of the design partners.");
    expect(enriched.recommendationBody).toBeUndefined();
  });

  it("never lets the model touch anything numeric", async () => {
    const engine = engineReturning("Headline.\n\nBody.");
    const out = engine.run(input);

    const enriched = await engine.maybeEnrichRecommendation(out, input);

    expect(enriched.confidence).toBe(out.confidence);
    expect(enriched.best.id).toBe(out.best.id);
    expect(enriched.futures.map((f) => f.id)).toEqual(out.futures.map((f) => f.id));
    expect(enriched.futures.map((f) => f.score)).toEqual(out.futures.map((f) => f.score));
  });
});
