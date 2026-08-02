import type { AIPort } from "../../domain/ai/AIPort";
import { AIProviderError } from "../../domain/ai/errors";
import type {
  CodeRequest,
  EmbedRequest,
  EmbedResult,
  GenerateRequest,
  GenerateResult,
  ReasonRequest,
  TaskGenerateRequest,
} from "../../domain/ai/types";

export type ProviderRouterOptions = {
  providers: Record<string, AIPort>;
  defaultProviderId: string;
};

/**
 * Routes capability calls to a configured adapter.
 * Engines depend on AIPort; this is the default composition root implementation.
 */
export class ProviderRouter implements AIPort {
  readonly id = "router";
  private readonly providers: Record<string, AIPort>;
  private readonly defaultProviderId: string;

  constructor(options: ProviderRouterOptions) {
    this.providers = options.providers;
    this.defaultProviderId = options.defaultProviderId;
    if (!this.providers[this.defaultProviderId]) {
      throw new AIProviderError(
        this.id,
        `Default provider "${this.defaultProviderId}" is not registered`
      );
    }
  }

  get activeProviderId(): string {
    return this.defaultProviderId;
  }

  resolve(providerId?: string): AIPort {
    const id = providerId ?? this.defaultProviderId;
    const port = this.providers[id];
    if (!port) {
      throw new AIProviderError(this.id, `Unknown AI provider: ${id}`);
    }
    return port;
  }

  async generate(req: GenerateRequest): Promise<GenerateResult> {
    return this.resolve().generate(req);
  }

  async generateTask(req: TaskGenerateRequest): Promise<GenerateResult> {
    return this.resolve().generateTask(req);
  }

  async embed(req: EmbedRequest): Promise<EmbedResult> {
    return this.resolve().embed(req);
  }

  async reason(req: ReasonRequest): Promise<GenerateResult> {
    return this.resolve().reason(req);
  }

  async code(req: CodeRequest): Promise<GenerateResult> {
    return this.resolve().code(req);
  }
}
