import type { AIProvider, GenerateRequest, GenerateResponse } from "../provider";

/**
 * Offline adapter for tests and deterministic product paths.
 * Does not call external networks.
 */
export class DeterministicAdapter implements AIProvider {
  readonly id = "deterministic";

  async generate(request: GenerateRequest): Promise<GenerateResponse> {
    const contextKeys = request.context ? Object.keys(request.context).sort().join(",") : "";
    return {
      text: `[deterministic:${request.model}] ${request.prompt.slice(0, 500)}${
        contextKeys ? ` | context=${contextKeys}` : ""
      }`,
      model: request.model || "deterministic",
      provider: this.id,
      usage: { inputTokens: 0, outputTokens: 0 },
    };
  }
}
