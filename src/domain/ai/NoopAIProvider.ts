import type { AIPort } from "./AIPort";
import type {
  CodeRequest,
  EmbedRequest,
  EmbedResult,
  GenerateRequest,
  GenerateResult,
  ReasonRequest,
  TaskGenerateRequest,
} from "./types";

/** Pure domain default — no I/O. Safe for tests and public beta sims. */
export class NoopAIProvider implements AIPort {
  readonly id = "noop";

  async generate(_req: GenerateRequest): Promise<GenerateResult> {
    return { text: "", model: "noop", provider: this.id };
  }

  async generateTask(_req: TaskGenerateRequest): Promise<GenerateResult> {
    return { text: "", model: "noop", provider: this.id };
  }

  async embed(_req: EmbedRequest): Promise<EmbedResult> {
    return { vectors: [], model: "noop", provider: this.id };
  }

  async reason(req: ReasonRequest): Promise<GenerateResult> {
    return this.generate(req);
  }

  async code(req: CodeRequest): Promise<GenerateResult> {
    return this.generate(req);
  }
}
