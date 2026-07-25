/** Model-agnostic AI generation contract. Adapters implement this; callers never import vendor SDKs. */

export type GenerateRequest = {
  /** Logical model tier or vendor model id (e.g. "reasoning", "gpt-4.1"). */
  model: string;
  prompt: string;
  context?: Record<string, unknown>;
  temperature?: number;
  maxTokens?: number;
  system?: string;
};

export type GenerateResponse = {
  text: string;
  model: string;
  provider: string;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
  };
  raw?: unknown;
};

export interface AIProvider {
  readonly id: string;
  generate(request: GenerateRequest): Promise<GenerateResponse>;
}

export class AIProviderError extends Error {
  constructor(
    message: string,
    readonly provider: string,
    readonly cause?: unknown
  ) {
    super(message);
    this.name = "AIProviderError";
  }
}
