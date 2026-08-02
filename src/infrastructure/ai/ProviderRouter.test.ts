import { describe, expect, it } from "vitest";
import { NoopAIProvider } from "../../domain/ai/NoopAIProvider";
import type { AIPort } from "../../domain/ai/AIPort";
import { buildTaskMessages } from "../../domain/ai/taskPrompts";
import type { GenerateRequest, GenerateResult, TaskGenerateRequest } from "../../domain/ai/types";
import { ProviderRouter } from "./ProviderRouter";

class StubAI implements AIPort {
  readonly id = "stub";
  async generate(req: GenerateRequest): Promise<GenerateResult> {
    return { text: `echo:${req.prompt}`, model: "stub-m", provider: this.id };
  }
  async generateTask(req: TaskGenerateRequest): Promise<GenerateResult> {
    const built = buildTaskMessages(req);
    return this.generate({
      system: built.system,
      prompt: built.prompt,
      maxTokens: built.maxTokens,
    });
  }
  async embed() {
    return { vectors: [[1]], model: "stub-m", provider: this.id };
  }
  async reason(req: GenerateRequest) {
    return this.generate(req);
  }
  async code(req: GenerateRequest) {
    return this.generate(req);
  }
}

describe("ProviderRouter", () => {
  it("delegates to default provider", async () => {
    const router = new ProviderRouter({
      providers: { noop: new NoopAIProvider(), stub: new StubAI() },
      defaultProviderId: "stub",
    });
    const r = await router.generate({ prompt: "hi" });
    expect(r.text).toBe("echo:hi");
    expect(r.provider).toBe("stub");
  });

  it("throws if default missing", () => {
    expect(
      () =>
        new ProviderRouter({
          providers: { noop: new NoopAIProvider() },
          defaultProviderId: "missing",
        })
    ).toThrow(/not registered/i);
  });
});
