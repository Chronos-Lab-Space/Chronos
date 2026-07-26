/**
 * OpenAI-compatible `/chat/completions` shaping and parsing.
 *
 * One wire format covers nearly every open-weights host — Groq, Together,
 * OpenRouter, Cerebras, Hugging Face's router, DeepInfra, Fireworks, and
 * anything self-hosted behind vLLM, llama.cpp, LM Studio, or Ollama's
 * OpenAI shim. Picking a provider is therefore two secrets (base URL and
 * model), not a code change.
 *
 * Deliberately dependency-free and free of Deno globals so it can be unit
 * tested by vitest alongside the rest of the app. The parsing here is the
 * part most likely to break against a new provider, so it is the part
 * that needs tests.
 */

export type ChatCompletionBody = {
  model: string;
  messages: { role: "system" | "user"; content: string }[];
  max_tokens: number;
  temperature: number;
  stream: false;
};

export type ParsedCompletion = {
  text: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  finishReason: string | null;
};

/**
 * Join a provider base URL with the chat-completions path.
 *
 * Providers document their base inconsistently — some as
 * `https://host/openai/v1`, some with a trailing slash, and people paste
 * the full endpoint about as often as the base. All three land in the
 * same place rather than a 404 the user has to debug through a proxy.
 */
export function chatCompletionsUrl(baseUrl: string): string {
  const trimmed = baseUrl.trim().replace(/\/+$/, "");
  if (!trimmed) throw new Error("AI_BASE_URL is empty");
  if (trimmed.endsWith("/chat/completions")) return trimmed;
  return `${trimmed}/chat/completions`;
}

export function buildChatCompletionBody(input: {
  model: string;
  system: string;
  prompt: string;
  maxTokens: number;
  temperature?: number;
}): ChatCompletionBody {
  return {
    model: input.model,
    messages: [
      { role: "system", content: input.system },
      { role: "user", content: input.prompt },
    ],
    // `max_tokens` rather than `max_completion_tokens`: the older name is
    // the one every OSS-compatible server still accepts.
    max_tokens: input.maxTokens,
    temperature: input.temperature ?? 0.3,
    stream: false,
  };
}

/**
 * Remove chain-of-thought that reasoning-tuned open models emit inline.
 *
 * Qwen, DeepSeek-R1 distills, and several gpt-oss builds wrap their
 * scratchpad in <think>…</think> and expect the caller to drop it. Left
 * in, it would be rendered to the user as the recommendation.
 */
export function stripReasoning(raw: string): string {
  let text = raw.replace(/<think>[\s\S]*?<\/think>/gi, "");
  // An unterminated block means the model hit the token ceiling mid-
  // thought. Everything from the tag on is scratchpad, so drop the tail.
  const dangling = text.search(/<think>/i);
  if (dangling !== -1) text = text.slice(0, dangling);
  return text.trim();
}

function asFiniteInt(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0;
}

/**
 * Map a chat-completions response onto the proxy's own shape.
 *
 * Throws only when the body is structurally unusable. An empty or refused
 * completion is a valid result, not an error: the caller returns it as
 * empty text and the engine keeps its deterministic recommendation.
 */
export function parseChatCompletion(json: unknown, fallbackModel: string): ParsedCompletion {
  if (typeof json !== "object" || json === null) {
    throw new Error("Upstream returned a non-object body");
  }
  const body = json as Record<string, unknown>;

  // Providers surface errors inside a 200 often enough to check for it.
  if (body.error) {
    const err = body.error as Record<string, unknown>;
    const message = typeof err.message === "string" ? err.message : JSON.stringify(err);
    throw new Error(message);
  }

  const choices = Array.isArray(body.choices) ? body.choices : [];
  const first = (choices[0] ?? null) as Record<string, unknown> | null;
  const message = (first?.message ?? null) as Record<string, unknown> | null;

  // `content` is null when a reasoning model spent its whole budget in
  // `reasoning_content`, and when a refusal is returned instead.
  const content = typeof message?.content === "string" ? message.content : "";
  const usage = (body.usage ?? {}) as Record<string, unknown>;

  return {
    text: stripReasoning(content),
    model: typeof body.model === "string" && body.model ? body.model : fallbackModel,
    promptTokens: asFiniteInt(usage.prompt_tokens),
    completionTokens: asFiniteInt(usage.completion_tokens),
    finishReason: typeof first?.finish_reason === "string" ? first.finish_reason : null,
  };
}
