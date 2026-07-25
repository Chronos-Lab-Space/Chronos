import {
  AIProviderError,
  type AIProvider,
  type GenerateRequest,
  type GenerateResponse,
} from "../provider";

export type AnthropicAdapterOptions = {
  apiKey?: string;
  baseUrl?: string;
  defaultModel?: string;
  fetchImpl?: typeof fetch;
};

/** Anthropic Messages API adapter (fetch only — no SDK dependency). */
export class AnthropicAdapter implements AIProvider {
  readonly id = "anthropic";
  private readonly apiKey: string | undefined;
  private readonly baseUrl: string;
  private readonly defaultModel: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: AnthropicAdapterOptions = {}) {
    this.apiKey = options.apiKey;
    this.baseUrl = (options.baseUrl ?? "https://api.anthropic.com/v1").replace(/\/$/, "");
    this.defaultModel = options.defaultModel ?? "claude-sonnet-4-20250514";
    this.fetchImpl = options.fetchImpl ?? fetch.bind(globalThis);
  }

  async generate(request: GenerateRequest): Promise<GenerateResponse> {
    if (!this.apiKey) {
      throw new AIProviderError("Anthropic API key not configured", this.id);
    }

    const model =
      request.model === "reasoning"
        ? "claude-sonnet-4-20250514"
        : request.model === "fast"
          ? "claude-haiku-4-5-20251001"
          : request.model || this.defaultModel;

    const userContent =
      request.context && Object.keys(request.context).length > 0
        ? `${request.prompt}\n\nContext:\n${JSON.stringify(request.context)}`
        : request.prompt;

    const res = await this.fetchImpl(`${this.baseUrl}/messages`, {
      method: "POST",
      headers: {
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        max_tokens: request.maxTokens ?? 2048,
        temperature: request.temperature,
        system: request.system,
        messages: [{ role: "user", content: userContent }],
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new AIProviderError(
        `Anthropic request failed (${res.status}): ${body.slice(0, 400)}`,
        this.id
      );
    }

    const raw = (await res.json()) as {
      content?: Array<{ type?: string; text?: string }>;
      usage?: { input_tokens?: number; output_tokens?: number };
      model?: string;
    };

    const text =
      raw.content
        ?.filter((block) => block.type === "text")
        .map((block) => block.text ?? "")
        .join("") ?? "";

    return {
      text,
      model: raw.model ?? model,
      provider: this.id,
      usage: {
        inputTokens: raw.usage?.input_tokens,
        outputTokens: raw.usage?.output_tokens,
      },
      raw,
    };
  }
}
