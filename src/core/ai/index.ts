export type { AIProvider, GenerateRequest, GenerateResponse } from "./provider";
export { AIProviderError } from "./provider";
export { AIRegistry, ai } from "./registry";
export { OpenAIAdapter } from "./adapters/openai";
export { QwenAdapter } from "./adapters/qwen";
export { OllamaAdapter } from "./adapters/ollama";
export { AnthropicAdapter } from "./adapters/anthropic";
export { GeminiAdapter } from "./adapters/gemini";
export { DeterministicAdapter } from "./adapters/deterministic";

import { ai } from "./registry";
import { DeterministicAdapter } from "./adapters/deterministic";

/** Default offline provider so `ai.generate` is always callable without secrets. */
if (!ai.has("deterministic")) {
  ai.register(new DeterministicAdapter(), { default: true });
}
