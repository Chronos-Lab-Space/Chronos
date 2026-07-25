import {
  AIProviderError,
  type AIProvider,
  type GenerateRequest,
  type GenerateResponse,
} from "../provider";

export type OllamaAdapterOptions = {
  baseUrl?: string;
  defaultModel?: string;
  fetchImpl?: typeof fetch;
};

/** Local Ollama adapter (no API key). */
export class OllamaAdapter implements AIProvider {
  readonly id = "ollama";
  private readonly baseUrl: string;
  private readonly defaultModel: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: OllamaAdapterOptions = {}) {
    this.baseUrl = (options.baseUrl ?? "http://127.0.0.1:11434").replace(/\/$/, "");
    this.defaultModel = options.defaultModel ?? "llama3.2";
    this.fetchImpl = options.fetchImpl ?? fetch.bind(globalThis);
  }

  async generate(request: GenerateRequest): Promise<GenerateResponse> {
    const model =
      request.model === "reasoning" || request.model === "fast"
        ? this.defaultModel
        : request.model || this.defaultModel;

    const prompt = [
      request.system ? `System: ${request.system}` : null,
      request.prompt,
      request.context && Object.keys(request.context).length > 0
        ? `Context: ${JSON.stringify(request.context)}`
        : null,
    ]
      .filter(Boolean)
      .join("\n\n");

    let res: Response;
    try {
      res = await this.fetchImpl(`${this.baseUrl}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          prompt,
          stream: false,
          options: {
            temperature: request.temperature,
            num_predict: request.maxTokens,
          },
        }),
      });
    } catch (cause) {
      throw new AIProviderError("Ollama unreachable", this.id, cause);
    }

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new AIProviderError(
        `Ollama request failed (${res.status}): ${body.slice(0, 400)}`,
        this.id
      );
    }

    const raw = (await res.json()) as {
      response?: string;
      model?: string;
      prompt_eval_count?: number;
      eval_count?: number;
    };

    return {
      text: raw.response ?? "",
      model: raw.model ?? model,
      provider: this.id,
      usage: {
        inputTokens: raw.prompt_eval_count,
        outputTokens: raw.eval_count,
      },
      raw,
    };
  }
}
