import type { AIPort } from "../../domain/ai/AIPort";
import { AICapabilityError, AIProviderError } from "../../domain/ai/errors";
import type {
  CodeRequest,
  EmbedRequest,
  EmbedResult,
  GenerateRequest,
  GenerateResult,
  ReasonRequest,
  TaskGenerateRequest,
} from "../../domain/ai/types";

/**
 * Why a call did not produce text. `stage` says how far it got, which is
 * what separates "nobody configured this" from "the upstream is down".
 * A rejected session appears here as an HTTP 401 — a missing one never
 * does, because that is an ordinary signed-out visitor, not a fault.
 */
export type ProxyFailure = {
  stage: "config" | "network" | "http";
  status?: number;
  message: string;
};

export type ProxyAIProviderOptions = {
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
  /**
   * Told about every failure that is not simply "signed out". Injected for
   * the same reason as the token getter, and called for its side effect
   * only — the throw that follows is what the engine acts on.
   */
  onFailure?: (failure: ProxyFailure) => void;
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
 * Hosted generation via the `ai-generate` Supabase Edge Function.
 *
 * Which model actually answers — an open-weights model on Groq, Together,
 * OpenRouter or a self-hosted server, or Anthropic — is decided by the
 * function's secrets. The browser deliberately cannot tell and cannot
 * choose: that is what keeps the key, the model, and the bill out of a
 * bundle anyone can read.
 *
 * There is likewise no key option on this adapter. A browser-held
 * provider key would ship in `dist/` on the first build.
 *
 * Opt in with VITE_AI_PROVIDER=proxy.
 */
export class ProxyAIProvider implements AIPort {
  readonly id = "proxy";
  private readonly proxyUrl: string;
  private readonly getAccessToken: () => Promise<string | null>;
  private readonly fetchImpl: typeof fetch;
  private readonly onFailure: (failure: ProxyFailure) => void;

  constructor(options: ProxyAIProviderOptions = {}) {
    this.proxyUrl = (options.proxyUrl ?? "").replace(/\/$/, "");
    this.getAccessToken = options.getAccessToken ?? (async () => null);
    this.fetchImpl = options.fetchImpl ?? fetch.bind(globalThis);
    this.onFailure = options.onFailure ?? (() => {});
  }

  /** Reporting is best-effort: a monitoring bug must not mask the real error. */
  private report(failure: ProxyFailure): void {
    try {
      this.onFailure(failure);
    } catch {
      /* swallowed on purpose — the AIProviderError below is what matters */
    }
  }

  async generate(_req: GenerateRequest): Promise<GenerateResult> {
    // The ai-generate function only accepts task-shaped bodies now that
    // its one live caller (SimulationEngine) uses generateTask — see
    // SPEC-ai-proxy.md "Later slices".
    throw new AICapabilityError(
      this.id,
      "generate",
      "The ai-generate proxy requires a task-shaped request — use generateTask."
    );
  }

  async generateTask(req: TaskGenerateRequest): Promise<GenerateResult> {
    // Task-shaped: the Edge Function owns the prompt; we only send fields.
    return this.postJson({
      task: req.task,
      fields: req.fields,
      ...(req.maxTokens != null ? { maxTokens: req.maxTokens } : {}),
    });
  }

  private async postJson(body: Record<string, unknown>): Promise<GenerateResult> {
    if (!this.proxyUrl) {
      const message = "No AI proxy URL configured (VITE_SUPABASE_URL unset).";
      this.report({ stage: "config", message });
      throw new AIProviderError(this.id, message);
    }

    const token = await this.getAccessToken();
    if (!token) {
      // Signed out, or the session expired. Throwing is correct: the
      // engine's enrich path is fail-open, so the user sees the
      // deterministic recommendation rather than an error.
      throw new AIProviderError(this.id, "No Supabase session — cannot call the AI proxy.");
    }

    let res: Response;
    try {
      res = await this.fetchImpl(this.proxyUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });
    } catch (err) {
      const message = `Cannot reach the AI proxy: ${err instanceof Error ? err.message : String(err)}`;
      this.report({ stage: "network", message });
      throw new AIProviderError(this.id, message);
    }

    if (!res.ok) {
      const message = await describeFailure(res);
      this.report({ stage: "http", status: res.status, message });
      throw new AIProviderError(this.id, message, res.status);
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

  async reason(_req: ReasonRequest): Promise<GenerateResult> {
    // No task kind exists for free-form reasoning yet — same task-shaped
    // constraint as generate().
    throw new AICapabilityError(
      this.id,
      "reason",
      "The ai-generate proxy requires a task-shaped request — use generateTask."
    );
  }

  async code(_req: CodeRequest): Promise<GenerateResult> {
    // No task kind exists for code generation — retired, see
    // SPEC-llm-capability.md.
    throw new AICapabilityError(
      this.id,
      "code",
      "The ai-generate proxy requires a task-shaped request — use generateTask."
    );
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
