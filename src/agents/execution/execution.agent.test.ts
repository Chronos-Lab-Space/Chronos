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
import { ExecutionAgent } from "./index";

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

const planTask = (input: Record<string, unknown>) => ({
  id: "t1",
  capability: "plan",
  input,
});

describe("ExecutionAgent", () => {
  it("returns a structured stub under Noop (default)", async () => {
    const agent = new ExecutionAgent(new NoopAIProvider());
    const result = await agent.execute(planTask({ objective: "Launch the public beta" }));

    expect(result.ok).toBe(true);
    expect(result.data.source).toBe("stub");
    expect(result.data.steps).toEqual([]);
    // Prior contract — callers already rely on these two fields.
    expect(result.data.accepted).toBe(true);
    expect(String(result.data.summary)).toContain("Execution stub");
  });

  it("uses AIPort when configured and returns source: ai", async () => {
    const agent = new ExecutionAgent(
      new StubAI("1. Freeze scope\n2. Invite 50 users\n3. Watch activation for a week")
    );
    const result = await agent.execute(planTask({ objective: "Launch the public beta" }));

    expect(result.ok).toBe(true);
    expect(result.data.source).toBe("ai");
    expect(result.data.provider).toBe("stub");
    expect(result.data.model).toBe("stub-model");
    expect(result.data.accepted).toBe(true);
    const steps = result.data.steps as string[];
    expect(steps).toHaveLength(3);
    // Ordinals are stripped — the array position is the order.
    expect(steps[0]).toBe("Freeze scope");
    expect(steps[2]).toBe("Watch activation for a week");
  });

  it("fails open to stub when AI throws", async () => {
    const agent = new ExecutionAgent(new StubAI("", true));
    const result = await agent.execute(planTask({ objective: "Ship billing" }));

    expect(result.ok).toBe(true);
    expect(result.data.source).toBe("stub");
    expect(result.data.steps).toEqual([]);
  });

  it("fails open to stub when AI returns empty text", async () => {
    const agent = new ExecutionAgent(new StubAI("   "));
    const result = await agent.execute(planTask({ objective: "Ship billing" }));

    expect(result.ok).toBe(true);
    expect(result.data.source).toBe("stub");
  });

  it("does not call the AI without an objective to plan against", async () => {
    // No prompt means nothing to plan — spending a call here would bill the
    // owner for a guess. Stub without touching the port.
    let called = false;
    class SpyAI extends StubAI {
      override async generate(req: GenerateRequest): Promise<GenerateResult> {
        called = true;
        return super.generate(req);
      }
    }
    const agent = new ExecutionAgent(new SpyAI("1. Something"));
    const result = await agent.execute(planTask({}));

    expect(called).toBe(false);
    expect(result.data.source).toBe("stub");
  });
});
