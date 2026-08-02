import { describe, expect, it } from "vitest";
import type { AIPort } from "../../domain/ai/AIPort";
import { NoopAIProvider } from "../../domain/ai/NoopAIProvider";
import { buildTaskMessages } from "../../domain/ai/taskPrompts";
import type {
  CodeRequest,
  EmbedRequest,
  EmbedResult,
  GenerateRequest,
  GenerateResult,
  ReasonRequest,
  TaskGenerateRequest,
} from "../../domain/ai/types";
import { ResearchAgent } from "./index";

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
  async generateTask(req: TaskGenerateRequest): Promise<GenerateResult> {
    const built = buildTaskMessages(req);
    return this.generate({
      system: built.system,
      prompt: built.prompt,
      maxTokens: built.maxTokens,
    });
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

describe("ResearchAgent", () => {
  it("returns a structured stub under Noop (default)", async () => {
    const agent = new ResearchAgent(new NoopAIProvider());
    const result = await agent.execute({
      id: "t1",
      capability: "research.competitors",
      input: { prompt: "AI code review tools for enterprises" },
    });

    expect(result.ok).toBe(true);
    expect(result.data.source).toBe("stub");
    expect(String(result.data.summary)).toContain("Research stub for:");
    expect(result.data.findings).toEqual([]);
  });

  it("uses AIPort when configured and returns source: ai", async () => {
    const agent = new ResearchAgent(
      new StubAI("- Competitor A focuses on IDE plugins\n- Competitor B sells seat licenses")
    );
    const result = await agent.execute({
      id: "t2",
      capability: "research.competitors",
      input: { objective: "developer tooling for LLM apps" },
    });

    expect(result.ok).toBe(true);
    expect(result.data.source).toBe("ai");
    expect(result.data.provider).toBe("stub");
    expect(String(result.data.summary)).toContain("Competitor A");
    expect(Array.isArray(result.data.findings)).toBe(true);
    expect((result.data.findings as string[]).length).toBeGreaterThan(0);
  });

  it("fails open to stub when AI throws", async () => {
    const agent = new ResearchAgent(new StubAI("", true));
    const result = await agent.execute({
      id: "t3",
      capability: "research.competitors",
      input: { prompt: "fintech payments" },
    });

    expect(result.ok).toBe(true);
    expect(result.data.source).toBe("stub");
    expect(String(result.data.summary)).toContain("fintech payments");
  });

  it("fails open to stub when AI returns empty text", async () => {
    const agent = new ResearchAgent(new StubAI("   "));
    const result = await agent.execute({
      id: "t4",
      capability: "research.competitors",
      input: { prompt: "health SaaS" },
    });

    expect(result.ok).toBe(true);
    expect(result.data.source).toBe("stub");
  });
});
