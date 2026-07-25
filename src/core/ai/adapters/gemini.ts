import {
  AIProviderError,
  type AIProvider,
  type GenerateRequest,
  type GenerateResponse,
} from "../provider";

export type GeminiAdapterOptions = {
  apiKey?: string;
  baseUrl?: string;
  defaultModel?: string;
  fetchImpl?: typeof fetch;
};

/** Google Gemini generateContent adapter (fetch only). */
export class GeminiAdapter implements AIProvider {
  readonly id = "gemini";
  private readonly apiKey: string | undefined;
  private readonly baseUrl: string;
  private readonly defaultModel: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: GeminiAdapterOptions = {}) {
    this.apiKey = options.apiKey;
    this.baseUrl = (
      options.baseUrl ?? "https://generativelanguage.googleapis.com/v1beta"
    ).replace(/\/$/, "");
    this.defaultModel = options.defaultModel ?? "gemini-2.0-flash";
    this.fetchImpl = options.fetchImpl ?? fetch.bind(globalThis);
  }

  async generate(request: GenerateRequest): Promise<GenerateResponse> {
    if (!this.apiKey) {
      throw new AIProviderError("Gemini API key not configured", this.id);
    }

    const model =
      request.model === "reasoning" || request.model === "fast"
        ? this.defaultModel
        : request.model || this.defaultModel;

    const textParts = [
      request.system ? `System: ${request.system}` : null,
      request.prompt,
      request.context && Object.keys(request.context).length > 0
        ? `Context: ${JSON.stringify(request.context)}`
        : null,
    ]
      .filter(Boolean)
      .join("\n\n");

    const url = `${this.baseUrl}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(this.apiKey)}`;

    const res = await this.fetchImpl(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: textParts }] }],
        generationConfig: {
          temperature: request.temperature,
          maxOutputTokens: request.maxTokens,
        },
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new AIProviderError(
        `Gemini request failed (${res.status}): ${body.slice(0, 400)}`,
        this.id
      );
    }

    const raw = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
      modelVersion?: string;
    };

    const text =
      raw.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("") ?? "";

    return {
      text,
      model: raw.modelVersion ?? model,
      provider: this.id,
      usage: {
        inputTokens: raw.usageMetadata?.promptTokenCount,
        outputTokens: raw.usageMetadata?.candidatesTokenCount,
      },
      raw,
    };
  }
}
