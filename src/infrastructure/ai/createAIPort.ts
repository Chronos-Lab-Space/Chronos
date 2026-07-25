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
