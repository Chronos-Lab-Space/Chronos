import {
  AIProviderError,
  type AIProvider,
  type GenerateRequest,
  type GenerateResponse,
} from "../provider";

export type OpenAIAdapterOptions = {
  apiKey?: string;
  baseUrl?: string;
  defaultModel?: string;
  fetchImpl?: typeof fetch;
};

/**
 * OpenAI Responses API adapter (fetch only — no SDK dependency).
 * Key must be supplied by the host (never bake secrets into the SPA).
 */
export class OpenAIAdapter implements AIProvider {
  readonly id = "openai";
  private readonly apiKey: string | undefined;
  private readonly baseUrl: string;
  private readonly defaultModel: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: OpenAIAdapterOptions = {}) {
    this.apiKey = options.apiKey;
    this.baseUrl = (options.baseUrl ?? "https://api.openai.com/v1").replace(/\/$/, "");
    this.defaultModel = options.defaultModel ?? "gpt-4.1-mini";
    this.fetchImpl = options.fetchImpl ?? fetch.bind(globalThis);
  }

  async generate(request: GenerateRequest): Promise<GenerateResponse> {
    if (!this.apiKey) {
      throw new AIProviderError("OpenAI API key not configured", this.id);
    }

    const model = mapModel(request.model, this.defaultModel);
    const input = buildInput(request);

    const res = await this.fetchImpl(`${this.baseUrl}/responses`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        input,
        temperature: request.temperature,
        max_output_tokens: request.maxTokens,
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new AIProviderError(
        `OpenAI request failed (${res.status}): ${body.slice(0, 400)}`,
        this.id
      );
    }

    const raw = (await res.json()) as {
      output_text?: string;
      output?: Array<{ content?: Array<{ type?: string; text?: string }> }>;
      usage?: { input_tokens?: number; output_tokens?: number };
      model?: string;
    };

    const text =
      raw.output_text ??
      raw.output
        ?.flatMap((item) => item.content ?? [])
        .filter((part) => part.type === "output_text" || typeof part.text === "string")
        .map((part) => part.text ?? "")
        .join("") ??
      "";

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

function mapModel(logical: string, fallback: string): string {
  if (logical === "reasoning") return "o4-mini";
  if (logical === "fast") return "gpt-4.1-mini";
  return logical || fallback;
}

function buildInput(request: GenerateRequest): unknown {
  const parts: Array<{ role: string; content: string }> = [];
  if (request.system) {
    parts.push({ role: "system", content: request.system });
  }
  const contextBlock =
    request.context && Object.keys(request.context).length > 0
      ? `\n\nContext:\n${JSON.stringify(request.context)}`
      : "";
  parts.push({ role: "user", content: `${request.prompt}${contextBlock}` });
  return parts;
}
