import type { AIPort } from "../../domain/ai/AIPort";
import { NoopAIProvider } from "../../domain/ai/NoopAIProvider";
import { AnthropicAIProvider } from "./AnthropicAIProvider";
import { OllamaAIProvider } from "./OllamaAIProvider";
import { ProviderRouter } from "./ProviderRouter";

export type AIProviderId = "noop" | "ollama" | "anthropic";

function envString(key: string): string | undefined {
  // Browser (Vite)
  try {
    const v = (import.meta as ImportMeta & { env?: Record<string, string> }).env?.[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  } catch {
    /* non-vite */
  }
  // Node / tests
  if (typeof process !== "undefined" && process.env?.[key]) {
    const v = process.env[key]!.trim();
    if (v) return v;
  }
  return undefined;
}

/**
 * Whether to polish sim recommendation text via AIPort after deterministic collapse.
 * Default **on**. Set VITE_AI_SIM_ENRICH=false to force deterministic prose only.
 * Still a no-op when the active provider is noop or generate returns empty.
 * Scoring/futures never change.
 */
export function isAISimEnrichEnabled(): boolean {
  const v = (envString("VITE_AI_SIM_ENRICH") ?? envString("AI_SIM_ENRICH") ?? "true").toLowerCase();
  if (v === "0" || v === "false" || v === "no" || v === "off") return false;
  return v === "1" || v === "true" || v === "yes" || v === "on" || v === "";
}

/**
 * Endpoint of the `ai-generate` Supabase Edge Function, which holds the
 * Anthropic key server-side. Derived from the project URL unless
 * VITE_AI_PROXY_URL overrides it. Empty when Supabase is unconfigured —
 * the adapter then throws and the engine keeps deterministic prose.
 */
function resolveProxyUrl(explicit?: string): string {
  const direct = explicit ?? envString("VITE_AI_PROXY_URL") ?? envString("AI_PROXY_URL");
  if (direct) return direct;
  const base = envString("VITE_SUPABASE_URL") ?? envString("SUPABASE_URL");
  return base ? `${base.replace(/\/$/, "")}/functions/v1/ai-generate` : "";
}

/**
 * Read the caller's Supabase session token.
 *
 * Imported lazily so selecting noop or ollama never pulls the Supabase
 * client into the graph — and so unit tests that touch the default port
 * do not construct a client just to leave it unused.
 */
async function currentAccessToken(): Promise<string | null> {
  const { supabase } = await import("../supabase/client");
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

/**
 * Build AIPort from env.
 * Default: noop (deterministic, offline-safe for public beta sims).
 *
 * VITE_AI_PROVIDER=noop|ollama|anthropic
 * VITE_OLLAMA_URL / OLLAMA_HOST
 * VITE_OLLAMA_MODEL
 * VITE_AI_PROXY_URL (anthropic; defaults to the project's ai-generate function)
 */
export function createAIPortFromEnv(
  override?: Partial<{
    provider: AIProviderId;
    ollamaUrl: string;
    ollamaModel: string;
    proxyUrl: string;
    getAccessToken: () => Promise<string | null>;
  }>
): AIPort {
  const providerId = (
    override?.provider ??
    envString("VITE_AI_PROVIDER") ??
    envString("AI_PROVIDER") ??
    "noop"
  ).toLowerCase() as AIProviderId;

  const noop = new NoopAIProvider();
  const ollama = new OllamaAIProvider({
    baseUrl:
      override?.ollamaUrl ??
      envString("VITE_OLLAMA_URL") ??
      envString("OLLAMA_HOST") ??
      "http://127.0.0.1:11434",
    defaultModel: override?.ollamaModel ?? envString("VITE_OLLAMA_MODEL") ?? "llama3.2:1b",
  });

  const anthropic = new AnthropicAIProvider({
    proxyUrl: resolveProxyUrl(override?.proxyUrl),
    getAccessToken: override?.getAccessToken ?? currentAccessToken,
  });

  const providers: Record<string, AIPort> = {
    noop,
    ollama,
    anthropic,
  };

  const defaultProviderId = providerId in providers ? providerId : "noop";

  return new ProviderRouter({
    providers,
    defaultProviderId,
  });
}

let defaultPort: AIPort | null = null;

/** Process-wide default (SPA). Tests should inject ports, not rely on this. */
export function getDefaultAIPort(): AIPort {
  if (!defaultPort) {
    defaultPort = createAIPortFromEnv();
  }
  return defaultPort;
}

/** Test helper — reset singleton between cases. */
export function resetDefaultAIPort(): void {
  defaultPort = null;
}
