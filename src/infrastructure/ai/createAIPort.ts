import type { AIPort } from "../../domain/ai/AIPort";
import { NoopAIProvider } from "../../domain/ai/NoopAIProvider";
import { OllamaAIProvider } from "./OllamaAIProvider";
import { ProviderRouter } from "./ProviderRouter";

export type AIProviderId = "noop" | "ollama";

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
  const v = (
    envString("VITE_AI_SIM_ENRICH") ??
    envString("AI_SIM_ENRICH") ??
    "true"
  ).toLowerCase();
  if (v === "0" || v === "false" || v === "no" || v === "off") return false;
  return v === "1" || v === "true" || v === "yes" || v === "on" || v === "";
}

/**
 * Build AIPort from env.
 * Default: noop (deterministic, offline-safe for public beta sims).
 *
 * VITE_AI_PROVIDER=noop|ollama
 * VITE_OLLAMA_URL / OLLAMA_HOST
 * VITE_OLLAMA_MODEL
 */
export function createAIPortFromEnv(
  override?: Partial<{ provider: AIProviderId; ollamaUrl: string; ollamaModel: string }>
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
    defaultModel:
      override?.ollamaModel ?? envString("VITE_OLLAMA_MODEL") ?? "llama3.2:1b",
  });

  const providers: Record<string, AIPort> = {
    noop,
    ollama,
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
