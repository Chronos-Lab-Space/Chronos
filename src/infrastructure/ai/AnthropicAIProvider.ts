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

export type AnthropicAIProviderOptions = {
  /** Proxy endpoint. Defaults to `${VITE_SUPABASE_URL}/functions/v1/ai-generate`. */
  proxyUrl?: string;
  /**
   * Supplies the caller's Supabase session token. Injected rather than
   * imported so this adapter never reaches into infrastructure/auth and
   * stays trivially testable.
   */
  getAccessToken?: () => Promise<string | null>;
  /** Inject for tests */
  fetchImpl?: typeof fetch;
};

type ProxyResponse = {
  text?: unknown;
  model?: unknown;
  usage?: { promptTokens?: unknown; completionTokens?: unknown };
};

type ProxyError = {
  error?: unknown;
  message?: unknown;
};

/**
 * Hosted Anthropic via the `ai-generate` Supabase Edge Function.
 *
 * The API key is a Supabase secret held server-side — this adapter only
 * ever carries the user's own session JWT. There is deliberately no key
 * option here: a browser-held Anthropic key would ship in the bundle.
 *
 * Opt in with VITE_AI_PROVIDER=anthropic. Model choice lives in the
 * function's secrets, not here, so the bundle cannot pin an expensive one.
 */
export class AnthropicAIProvider implements AIPort {
  readonly id = "anthropic";
  private readonly proxyUrl: string;
  private readonly getAccessToken: () => Promise<string | null>;
  private readonly fetchImpl: typeof fetch;

  constructor(options: AnthropicAIProviderOptions = {}) {
    this.proxyUrl = (options.proxyUrl ?? "").replace(/\/$/, "");
    this.getAccessToken = options.getAccessToken ?? (async () => null);
    this.fetchImpl = options.fetchImpl ?? fetch.bind(globalThis);
  }

  async generate(req: GenerateRequest): Promise<GenerateResult> {
    if (!this.proxyUrl) {
      throw new AIProviderError(this.id, "No AI proxy URL configured (VITE_SUPABASE_URL unset).");
    }

    const token = await this.getAccessToken();
    if (!token) {
      // Signed out, or the session expired. Throwing is correct: the
      // engine's enrich path is fail-open, so the user sees the
      // deterministic recommendation rather than an error.
      throw new AIProviderError(this.id, "No Supabase session — cannot call the AI proxy.");
    }

    // Deliberately omits `temperature`: sampling params are rejected with
    // a 400 on Opus 5, and GenerateRequest still carries one because the
    // Ollama adapter uses it. Also omits `model` — the proxy decides.
    const body = JSON.stringify({
      prompt: req.prompt,
      ...(req.system ? { system: req.system } : {}),
      ...(req.maxTokens != null ? { maxTokens: req.maxTokens } : {}),
    });

    let res: Response;
    try {
      res = await this.fetchImpl(this.proxyUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body,
      });
    } catch (err) {
      throw new AIProviderError(
        this.id,
        `Cannot reach the AI proxy: ${err instanceof Error ? err.message : String(err)}`
      );
    }

    if (!res.ok) {
      throw new AIProviderError(this.id, await describeFailure(res), res.status);
    }

    let data: ProxyResponse;
    try {
      data = (await res.json()) as ProxyResponse;
    } catch {
      throw new AIProviderError(this.id, "AI proxy returned a non-JSON body.", res.status);
    }

    // An empty `text` is a valid outcome, not a failure — the proxy
    // returns it on a refusal so the engine keeps deterministic prose.
    return {
      text: typeof data.text === "string" ? data.text : "",
      model: typeof data.model === "string" ? data.model : "unknown",
      provider: this.id,
      usage: {
        promptTokens: numberOrUndefined(data.usage?.promptTokens),
        completionTokens: numberOrUndefined(data.usage?.completionTokens),
      },
    };
  }

  async embed(_req: EmbedRequest): Promise<EmbedResult> {
    throw new AICapabilityError(
      this.id,
      "embed",
      "The ai-generate proxy exposes text generation only."
    );
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
}

function numberOrUndefined(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

/** Prefer the proxy's own message; fall back to the status line. */
async function describeFailure(res: Response): Promise<string> {
  const raw = await res.text().catch(() => "");
  let message = raw.slice(0, 200);
  try {
    const parsed = JSON.parse(raw) as ProxyError;
    if (typeof parsed.message === "string" && parsed.message) {
      message = parsed.message;
    }
  } catch {
    /* non-JSON error body — keep the raw prefix */
  }
  return `AI proxy request failed (${res.status}): ${message}`;
}
