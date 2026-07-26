import type { AIPort } from "../../domain/ai/AIPort";
import { AICapabilityError, AIProviderError } from "../../domain/ai/errors";
import type {
  CodeRequest,
  EmbedRequest,
  EmbedResult,
  GenerateRequest,
  GenerateResult,
  ReasonRequest,
} from "../../domain/ai/types";

export type OllamaAIProviderOptions = {
  baseUrl?: string;
  defaultModel?: string;
  /** Inject for tests */
  fetchImpl?: typeof fetch;
};

/**
 * Local Ollama HTTP adapter (POST /api/generate, /api/embeddings).
 * Opt-in via VITE_AI_PROVIDER=ollama — not used on the default product path.
 */
export class OllamaAIProvider implements AIPort {
  readonly id = "ollama";
  private readonly baseUrl: string;
  private readonly defaultModel: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: OllamaAIProviderOptions = {}) {
    this.baseUrl = (options.baseUrl ?? "http://127.0.0.1:11434").replace(/\/$/, "");
    this.defaultModel = options.defaultModel ?? "llama3.2:1b";
    this.fetchImpl = options.fetchImpl ?? fetch.bind(globalThis);
  }

  async generate(req: GenerateRequest): Promise<GenerateResult> {
    const model = req.model ?? this.defaultModel;
    const body: Record<string, unknown> = {
      model,
      prompt: req.prompt,
      stream: false,
    };
    if (req.system) body.system = req.system;
    if (req.temperature != null || req.maxTokens != null) {
      body.options = {
        ...(req.temperature != null ? { temperature: req.temperature } : {}),
        ...(req.maxTokens != null ? { num_predict: req.maxTokens } : {}),
      };
    }

    const data = await this.postJson<{ response?: string; model?: string }>("/api/generate", body);
    return {
      text: typeof data.response === "string" ? data.response : "",
      model: typeof data.model === "string" ? data.model : model,
      provider: this.id,
    };
  }

  async embed(req: EmbedRequest): Promise<EmbedResult> {
    const model = req.model ?? this.defaultModel;
    const inputs = Array.isArray(req.input) ? req.input : [req.input];
    const vectors: number[][] = [];

    for (const prompt of inputs) {
      try {
        const data = await this.postJson<{
          embedding?: number[];
          embeddings?: number[][];
        }>("/api/embeddings", { model, prompt });
        if (Array.isArray(data.embedding)) {
          vectors.push(data.embedding);
        } else if (Array.isArray(data.embeddings?.[0])) {
          vectors.push(data.embeddings[0]!);
        } else {
          throw new AICapabilityError(
            this.id,
            "embed",
            "Ollama embeddings response missing embedding vector"
          );
        }
      } catch (err) {
        if (err instanceof AICapabilityError || err instanceof AIProviderError) throw err;
        throw new AICapabilityError(
          this.id,
          "embed",
          err instanceof Error ? err.message : "Ollama embed failed"
        );
      }
    }

    return { vectors, model, provider: this.id };
  }

  async reason(req: ReasonRequest): Promise<GenerateResult> {
    const system = [
      req.system,
      "Reason step by step. Be concise and decision-oriented.",
      req.schemaHint ? `Structure hint: ${req.schemaHint}` : null,
    ]
      .filter(Boolean)
      .join("\n");
    return this.generate({ ...req, system });
  }

  async code(req: CodeRequest): Promise<GenerateResult> {
    const lang = req.language ? `Language: ${req.language}.` : "";
    const system = [req.system, "You are a careful coding assistant.", lang]
      .filter(Boolean)
      .join(" ");
    return this.generate({ ...req, system });
  }

  private async postJson<T>(path: string, body: unknown): Promise<T> {
    let res: Response;
    try {
      res = await this.fetchImpl(`${this.baseUrl}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } catch (err) {
      throw new AIProviderError(
        this.id,
        `Cannot reach Ollama at ${this.baseUrl}: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    }

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new AIProviderError(
        this.id,
        `Ollama ${path} failed (${res.status}): ${detail.slice(0, 200)}`,
        res.status
      );
    }

    return (await res.json()) as T;
  }
}
