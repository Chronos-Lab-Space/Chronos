import type { AIProvider, GenerateRequest, GenerateResponse } from "./provider";
import { AIProviderError } from "./provider";

/** Registry of AI adapters. Prefer `ai.generate(...)` over vendor SDKs. */
export class AIRegistry {
  private readonly providers = new Map<string, AIProvider>();
  private defaultProviderId: string | null = null;

  register(provider: AIProvider, options?: { default?: boolean }): this {
    this.providers.set(provider.id, provider);
    if (options?.default || this.defaultProviderId === null) {
      this.defaultProviderId = provider.id;
    }
    return this;
  }

  has(id: string): boolean {
    return this.providers.has(id);
  }

  list(): readonly string[] {
    return [...this.providers.keys()];
  }

  get(id?: string): AIProvider {
    const key = id ?? this.defaultProviderId;
    if (!key) {
      throw new AIProviderError("No AI provider registered", "registry");
    }
    const provider = this.providers.get(key);
    if (!provider) {
      throw new AIProviderError(`Unknown AI provider: ${key}`, "registry");
    }
    return provider;
  }

  async generate(request: GenerateRequest, providerId?: string): Promise<GenerateResponse> {
    return this.get(providerId).generate(request);
  }
}

/** Process-wide AI facade. */
export const ai = new AIRegistry();
