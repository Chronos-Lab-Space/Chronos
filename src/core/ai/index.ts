/**
 * Core AI facade — single entry for app code that wants `ai.generate(...)`.
 *
 * Canonical contract lives in `domain/ai` (AIPort).
 * Composition / env wiring lives in `infrastructure/ai`.
 * Do not add vendor adapters here.
 */

export type {
  AIPort,
  AICapability,
  CodeRequest,
  EmbedRequest,
  EmbedResult,
  GenerateRequest as AIPortGenerateRequest,
  GenerateResult,
  ReasonRequest,
} from "../../domain/ai";
export { AICapabilityError, AIProviderError, NoopAIProvider } from "../../domain/ai";
export {
  createAIPortFromEnv,
  getDefaultAIPort,
  isAISimEnrichEnabled,
  resetDefaultAIPort,
  OllamaAIProvider,
  ProviderRouter,
} from "../../infrastructure/ai";
export type { AIProviderId } from "../../infrastructure/ai";

import { getDefaultAIPort } from "../../infrastructure/ai";
import type { GenerateResult } from "../../domain/ai";

/** Convenience request shape used by runtime/agents (maps onto AIPort.generate). */
export type GenerateRequest = {
  /** Logical tier ("reasoning" | "fast") or concrete model id. */
  model?: string;
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
};

function toPortModel(model: string | undefined): string | undefined {
  if (!model || model === "reasoning" || model === "fast") return undefined;
  return model;
}

function withContext(request: GenerateRequest): string {
  if (!request.context || Object.keys(request.context).length === 0) {
    return request.prompt;
  }
  return `${request.prompt}\n\nContext:\n${JSON.stringify(request.context)}`;
}

/**
 * Process-wide convenience API.
 * @example await ai.generate({ model: "reasoning", prompt, context })
 */
export const ai = {
  async generate(request: GenerateRequest): Promise<GenerateResponse> {
    const result: GenerateResult = await getDefaultAIPort().generate({
      prompt: withContext(request),
      system: request.system,
      model: toPortModel(request.model),
      temperature: request.temperature,
      maxTokens: request.maxTokens,
    });
    return {
      text: result.text,
      model: result.model,
      provider: result.provider,
      usage: {
        inputTokens: result.usage?.promptTokens,
        outputTokens: result.usage?.completionTokens,
      },
    };
  },
};
