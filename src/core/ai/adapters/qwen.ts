import {
  AIProviderError,
  type AIProvider,
  type GenerateRequest,
  type GenerateResponse,
} from "../provider";

export type QwenAdapterOptions = {
  apiKey?: string;
  baseUrl?: string;
  defaultModel?: string;
  fetchImpl?: typeof fetch;
};

/** DashScope / Qwen-compatible chat completions adapter (OpenAI-shaped API). */
export class QwenAdapter implements AIProvider {
  readonly id = "qwen";
  private readonly apiKey: string | undefined;
  private readonly baseUrl: string;
  private readonly defaultModel: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: QwenAdapterOptions = {}) {
    this.apiKey = options.apiKey;
    this.baseUrl = (
      options.baseUrl ?? "https://dashscope.aliyuncs.com/compatible-mode/v1"
    ).replace(/\/$/, "");
    this.defaultModel = options.defaultModel ?? "qwen-plus";
    this.fetchImpl = options.fetchImpl ?? fetch.bind(globalThis);
  }

  async generate(request: GenerateRequest): Promise<GenerateResponse> {
    if (!this.apiKey) {
      throw new AIProviderError("Qwen API key not configured", this.id);
    }

    const model = request.model === "reasoning" ? "qwen-plus" : request.model || this.defaultModel;
    const messages = toMessages(request);

    const res = await this.fetchImpl(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: request.temperature,
        max_tokens: request.maxTokens,
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new AIProviderError(
        `Qwen request failed (${res.status}): ${body.slice(0, 400)}`,
        this.id
      );
    }

    const raw = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
      model?: string;
    };

    return {
      text: raw.choices?.[0]?.message?.content ?? "",
      model: raw.model ?? model,
      provider: this.id,
      usage: {
        inputTokens: raw.usage?.prompt_tokens,
        outputTokens: raw.usage?.completion_tokens,
      },
      raw,
    };
  }
}

function toMessages(request: GenerateRequest): Array<{ role: string; content: string }> {
  const messages: Array<{ role: string; content: string }> = [];
  if (request.system) messages.push({ role: "system", content: request.system });
  const contextBlock =
    request.context && Object.keys(request.context).length > 0
      ? `\n\nContext:\n${JSON.stringify(request.context)}`
      : "";
  messages.push({ role: "user", content: `${request.prompt}${contextBlock}` });
  return messages;
}
