import { describe, expect, it } from "vitest";
import type { AIPort } from "../../domain/ai/AIPort";
import { NoopAIProvider } from "../../domain/ai/NoopAIProvider";
import type {
  CodeRequest,
  EmbedRequest,
  EmbedResult,
  GenerateRequest,
  GenerateResult,
  ReasonRequest,
} from "../../domain/ai/types";
import { CapabilityRegistry } from "./AgentOperatingSystem";
import { createDefaultCapabilityRegistry } from "./createDefaultCapabilityRegistry";
import { planChosenPath } from "./planChosenPath";

class StubAI implements AIPort {
  readonly id = "stub";
  constructor(
    private readonly text: string,
    private readonly shouldThrow = false
  ) {}
  async generate(_req: GenerateRequest): Promise<GenerateResult> {
    if (this.shouldThrow) throw new Error("upstream down");
    return { text: this.text, model: "stub-model", provider: this.id };
  }
  async embed(_req: EmbedRequest): Promise<EmbedResult> {
    return { vectors: [], model: "stub-model", provider: this.id };
  }
  async reason(req: ReasonRequest): Promise<GenerateResult> {
    return this.generate(req);
  }
  async code(req: CodeRequest): Promise<GenerateResult> {
    return this.generate(req);
  }
}

const chosen = {
  objective: "How should we launch the public beta with a small team?",
  pathName: "Invite-only beta",
  pathSummary: "Ship a gated beta to 50 users before opening signup.",
};

describe("planChosenPath", () => {
  it("returns steps from the plan capability when AI is configured", async () => {
    const registry = createDefaultCapabilityRegistry({
      ai: new StubAI("1. Freeze scope\n2. Invite 50 users\n3. Watch activation"),
    });

    const result = await planChosenPath(registry, chosen);

    expect(result.source).toBe("ai");
    expect(result.steps).toEqual(["Freeze scope", "Invite 50 users", "Watch activation"]);
  });

  it("returns no steps under noop rather than inventing them", async () => {
    const registry = createDefaultCapabilityRegistry({ ai: new NoopAIProvider() });

    const result = await planChosenPath(registry, chosen);

    expect(result.source).toBe("stub");
    expect(result.steps).toEqual([]);
  });

  it("fails open when the provider throws", async () => {
    const registry = createDefaultCapabilityRegistry({ ai: new StubAI("", true) });

    const result = await planChosenPath(registry, chosen);

    expect(result.source).toBe("stub");
    expect(result.steps).toEqual([]);
  });

  it("fails open when no plan capability is registered at all", async () => {
    // An empty registry resolves nothing — the collapse must still stand.
    const result = await planChosenPath(new CapabilityRegistry(), chosen);

    expect(result.source).toBe("stub");
    expect(result.steps).toEqual([]);
  });

  it("carries the chosen path into the objective, not just the question", async () => {
    // The plan is for the path the user committed to. Passing only the
    // objective would plan for the decision again instead of its outcome.
    let seenPrompt = "";
    class SpyAI extends StubAI {
      override async generate(req: GenerateRequest): Promise<GenerateResult> {
        seenPrompt = `${req.prompt}`;
        return super.generate(req);
      }
    }
    const registry = createDefaultCapabilityRegistry({ ai: new SpyAI("1. Do the thing") });

    await planChosenPath(registry, chosen);

    expect(seenPrompt).toContain("Invite-only beta");
  });
});
