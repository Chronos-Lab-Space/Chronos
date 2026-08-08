// ============================================================
// ai-generate — model key proxy for the Chronos SPA
//
// Chronos ships as a static bundle on GitHub Pages, so every VITE_* value
// is public. Any provider key therefore lives here, as a Supabase secret
// read from Deno.env, and the browser only ever holds its own session JWT.
//
// Two upstreams, chosen by secret, same request and response shape:
//
//   AI_UPSTREAM=openai     any OpenAI-compatible /chat/completions host —
//                          Groq, Together, OpenRouter, Cerebras, Hugging
//                          Face, or self-hosted vLLM / llama.cpp / Ollama.
//                          Open weights, and free on several of them.
//   AI_UPSTREAM=anthropic  the Anthropic Messages API.
//
// Unset, the upstream is inferred from whichever keys are present. The
// browser cannot see or influence the choice.
//
// The one caller today is SimulationEngine.maybeEnrichRecommendation —
// a 2-4 sentence rewrite of prose that was already computed
// deterministically. Scores, futures, ranking, and confidence never pass
// through this function and never come back from it.
//
// See SPEC-ai-proxy.md for the cost model and the quota rationale.
// ============================================================

import Anthropic from "npm:@anthropic-ai/sdk@^0.115.0";
import { withSupabase } from "npm:@supabase/server@1.4.0";
import {
  buildChatCompletionBody,
  chatCompletionsUrl,
  parseChatCompletion,
} from "../_shared/openaiCompatible.ts";
import { buildTaskMessages, isAITaskKind } from "../_shared/taskPrompts.ts";

/** Anthropic default. Override with ANTHROPIC_MODEL — never from the client. */
const DEFAULT_ANTHROPIC_MODEL = "claude-opus-5";

/** Upstream timeout. The SDK takes milliseconds. */
const UPSTREAM_TIMEOUT_MS = 30_000;

const MAX_SYSTEM_CHARS = 2_000;
const MAX_PROMPT_CHARS = 8_000;
const MAX_OUTPUT_TOKENS = 1_024;
const DEFAULT_OUTPUT_TOKENS = 280;

/**
 * Prepended to every client `system`, never overridable.
 *
 * `system` arrives from a bundle any signed-in user can edit, so this
 * endpoint is an authenticated relay bounded by quota rather than by
 * shape. This preamble is the cheap part of that bound; the caps, the
 * task-shaped body, and the ledger are the rest.
 */
const SERVER_PREAMBLE = [
  "You are a writing assistant embedded in a decision-analysis product.",
  "Output plain prose only — no code, no markup, no lists.",
  "Never exceed four sentences.",
  "Never invent numbers, metrics, dates, or citations.",
  "If the request is not a request to rewrite a decision recommendation,",
  "reply with the single word: unsupported.",
].join(" ");

/** Quota knobs. Secrets so they can be retuned without a redeploy. */
function envInt(key: string, fallback: number): number {
  const raw = Deno.env.get(key);
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

type ErrorCode =
  | "invalid_body"
  | "rate_limited"
  | "quota_exceeded"
  | "service_disabled"
  | "upstream_failed";

function fail(status: number, error: ErrorCode, message: string): Response {
  return Response.json({ error, message }, { status });
}

type ParsedBody = {
  system: string;
  prompt: string;
  maxTokens: number;
};

/** Validate and clamp. Returns a message string on rejection. */
function parseBody(raw: unknown): ParsedBody | string {
  if (typeof raw !== "object" || raw === null) {
    return "Body must be a JSON object.";
  }
  const body = raw as Record<string, unknown>;

  // Clamp rather than reject: an out-of-range value is a client bug, not
  // an attack, and the ceiling is what actually bounds the spend.
  let maxTokens = DEFAULT_OUTPUT_TOKENS;
  if (body.maxTokens != null) {
    const n = Number(body.maxTokens);
    if (!Number.isFinite(n) || n < 1) return "`maxTokens` must be a positive number.";
    maxTokens = Math.min(Math.floor(n), MAX_OUTPUT_TOKENS);
  }

  // Task-shaped only — the function owns the prompt. Free-text `prompt`
  // bodies were retired once the one live client (ProxyAIProvider)
  // moved to generateTask; see SPEC-ai-proxy.md "Later slices".
  if (body.task == null) {
    return "`task`+`fields` is required.";
  }
  if (!isAITaskKind(body.task)) {
    return `Unknown task "${String(body.task)}". Allowed: sim.recommendation, plan.steps, research.findings.`;
  }
  const fields =
    typeof body.fields === "object" && body.fields !== null && !Array.isArray(body.fields)
      ? (body.fields as Record<string, unknown>)
      : {};
  const built = buildTaskMessages({ task: body.task, fields, maxTokens });
  if (typeof built === "string") return built;
  if (built.prompt.length > MAX_PROMPT_CHARS) {
    return `Built prompt exceeds ${MAX_PROMPT_CHARS} characters.`;
  }
  if (built.system.length > MAX_SYSTEM_CHARS) {
    return `Built system exceeds ${MAX_SYSTEM_CHARS} characters.`;
  }
  return {
    system: built.system,
    prompt: built.prompt,
    maxTokens: Math.min(built.maxTokens, MAX_OUTPUT_TOKENS),
  };
}

function startOfMonthISO(now: Date): string {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

// ---- Upstream selection -----------------------------------------

type Upstream =
  | { kind: "anthropic"; apiKey: string; model: string }
  | { kind: "openai"; apiKey: string; baseUrl: string; model: string };

/**
 * Decide which upstream to call from secrets alone. Returns a message
 * string when the function is deployed without a usable configuration —
 * that surfaces as a 503, which the client turns into a fail-open.
 *
 * An explicit AI_UPSTREAM wins so that having both key sets present
 * (say, while comparing them) is not resolved by accident.
 */
function resolveUpstream(): Upstream | string {
  const explicit = (Deno.env.get("AI_UPSTREAM") ?? "").trim().toLowerCase();
  const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
  const openaiKey = Deno.env.get("AI_API_KEY");
  const baseUrl = Deno.env.get("AI_BASE_URL");

  const wantsOpenai = explicit === "openai" || (!explicit && !!baseUrl && !!openaiKey);
  const wantsAnthropic = explicit === "anthropic" || (!explicit && !!anthropicKey);

  if (explicit && explicit !== "openai" && explicit !== "anthropic") {
    return `AI_UPSTREAM must be "openai" or "anthropic", got "${explicit}".`;
  }

  if (wantsOpenai) {
    if (!baseUrl) return "AI_BASE_URL is not set.";
    if (!openaiKey) return "AI_API_KEY is not set.";
    // No default model: every host names its models differently, and
    // guessing one produces a 404 from inside a proxy, which is a
    // miserable thing to debug.
    const model = Deno.env.get("AI_MODEL");
    if (!model) return "AI_MODEL is not set.";
    return { kind: "openai", apiKey: openaiKey, baseUrl, model };
  }

  if (wantsAnthropic) {
    if (!anthropicKey) return "ANTHROPIC_API_KEY is not set.";
    return {
      kind: "anthropic",
      apiKey: anthropicKey,
      model: Deno.env.get("ANTHROPIC_MODEL") ?? DEFAULT_ANTHROPIC_MODEL,
    };
  }

  return "No AI provider is configured.";
}

type UpstreamResult = {
  text: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  stopReason: string | null;
};

async function callAnthropic(
  upstream: Extract<Upstream, { kind: "anthropic" }>,
  args: { system: string; prompt: string; maxTokens: number }
): Promise<UpstreamResult> {
  const client = new Anthropic({ apiKey: upstream.apiKey });
  const message = await client.messages.create(
    {
      model: upstream.model,
      max_tokens: args.maxTokens,
      system: args.system,
      messages: [{ role: "user", content: args.prompt }],
      // The cost lever that applies here: rewriting settled prose is not
      // a reasoning task, and `low` is strong on Opus 5.
      output_config: { effort: "low" },
      // Thinking is ON by default on Opus 5 and would share this
      // request's max_tokens with the answer. `disabled` is accepted only
      // at effort `high` or lower, so `low` qualifies.
      thinking: { type: "disabled" },
      // No temperature / top_p / top_k — removed on Opus 5, 400 if sent.
      // No stream — max_tokens is three orders below where it matters.
    },
    { timeout: UPSTREAM_TIMEOUT_MS }
  );

  // Refusals are read before the content blocks, and yield empty text so
  // the engine keeps its deterministic recommendation.
  const text =
    message.stop_reason === "refusal"
      ? ""
      : message.content
          .map((block) => (block.type === "text" ? block.text : ""))
          .join("")
          .trim();

  return {
    text,
    model: message.model ?? upstream.model,
    promptTokens: message.usage?.input_tokens ?? 0,
    completionTokens: message.usage?.output_tokens ?? 0,
    stopReason: message.stop_reason ?? null,
  };
}

async function callOpenAICompatible(
  upstream: Extract<Upstream, { kind: "openai" }>,
  args: { system: string; prompt: string; maxTokens: number }
): Promise<UpstreamResult> {
  const res = await fetch(chatCompletionsUrl(upstream.baseUrl), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${upstream.apiKey}`,
    },
    body: JSON.stringify(
      buildChatCompletionBody({
        model: upstream.model,
        system: args.system,
        prompt: args.prompt,
        maxTokens: args.maxTokens,
      })
    ),
    signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`${res.status} ${detail.slice(0, 200)}`);
  }

  const parsed = parseChatCompletion(await res.json(), upstream.model);
  return {
    text: parsed.text,
    model: parsed.model,
    promptTokens: parsed.promptTokens,
    completionTokens: parsed.completionTokens,
    stopReason: parsed.finishReason,
  };
}

export default {
  fetch: withSupabase({ auth: "user" }, async (req: Request, ctx) => {
    /**
     * Append to the ledger. Never throws — a bookkeeping failure must not
     * discard a response the owner has already been billed for. It does
     * mean the lost row is missing from the next quota check, which is the
     * right trade: under-counting one call beats losing the answer.
     */
    const recordUsage = async (row: {
      userId: string;
      model: string;
      inputTokens: number;
      outputTokens: number;
      stopReason: string | null;
      ok: boolean;
    }): Promise<void> => {
      const { error } = await ctx.supabaseAdmin.from("ai_usage").insert({
        user_id: row.userId,
        model: row.model,
        input_tokens: row.inputTokens,
        output_tokens: row.outputTokens,
        stop_reason: row.stopReason,
        ok: row.ok,
      });
      if (error) console.error("[ai-generate] failed to record usage:", error.message);
    };

    if (req.method !== "POST") {
      return fail(405, "invalid_body", "Use POST.");
    }

    const upstream = resolveUpstream();
    if (typeof upstream === "string") {
      // Deployed without a usable configuration: behave like a disabled
      // feature, not a crash. The client maps this to an AIProviderError
      // and the engine keeps its deterministic recommendation.
      return fail(503, "service_disabled", upstream);
    }

    const userId = ctx.userClaims?.id;
    if (!userId) {
      // auth: 'user' guarantees a verified JWT, so a missing id is a
      // contract violation rather than an auth failure — fail closed.
      return fail(503, "service_disabled", "Session carried no user id.");
    }

    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      return fail(400, "invalid_body", "Body is not valid JSON.");
    }

    const parsed = parseBody(rawBody);
    if (typeof parsed === "string") {
      return fail(400, "invalid_body", parsed);
    }

    // ---- Quota, before anything that costs money -------------------
    const now = new Date();
    const monthStart = startOfMonthISO(now);
    const minuteAgo = new Date(now.getTime() - 60_000).toISOString();

    const ratePerMinute = envInt("AI_RATE_PER_MINUTE", 6);
    const monthlyCap = envInt("AI_MONTHLY_CALL_CAP", 200);
    const globalCap = envInt("AI_GLOBAL_MONTHLY_CAP", 5_000);

    if (globalCap === 0) {
      return fail(503, "service_disabled", "AI provider is switched off.");
    }

    const [recent, thisMonth, globalThisMonth] = await Promise.all([
      ctx.supabaseAdmin
        .from("ai_usage")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .gte("created_at", minuteAgo),
      ctx.supabaseAdmin
        .from("ai_usage")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .gte("created_at", monthStart),
      ctx.supabaseAdmin
        .from("ai_usage")
        .select("id", { count: "exact", head: true })
        .gte("created_at", monthStart),
    ]);

    // A counting failure must not become a free pass — fail closed.
    if (recent.error || thisMonth.error || globalThisMonth.error) {
      return fail(503, "service_disabled", "Usage ledger unavailable.");
    }
    if ((recent.count ?? 0) >= ratePerMinute) {
      return fail(429, "rate_limited", "Too many requests — try again in a minute.");
    }
    if ((thisMonth.count ?? 0) >= monthlyCap) {
      return fail(429, "quota_exceeded", "Monthly AI allowance reached for this account.");
    }
    if ((globalThisMonth.count ?? 0) >= globalCap) {
      return fail(429, "quota_exceeded", "Monthly AI allowance reached.");
    }

    // ---- Upstream ---------------------------------------------------
    const system = parsed.system ? `${SERVER_PREAMBLE}\n\n${parsed.system}` : SERVER_PREAMBLE;
    const args = { system, prompt: parsed.prompt, maxTokens: parsed.maxTokens };

    const result = await (upstream.kind === "anthropic"
      ? callAnthropic(upstream, args)
      : callOpenAICompatible(upstream, args)
    ).catch((err: unknown) => (err instanceof Error ? err : new Error(String(err))));

    if (result instanceof Error) {
      await recordUsage({
        userId,
        model: upstream.model,
        inputTokens: 0,
        outputTokens: 0,
        stopReason: "error",
        ok: false,
      });
      return fail(
        502,
        "upstream_failed",
        `${upstream.kind} request failed: ${result.message.slice(0, 200)}`
      );
    }

    await recordUsage({
      userId,
      model: result.model,
      inputTokens: result.promptTokens,
      outputTokens: result.completionTokens,
      stopReason: result.stopReason,
      ok: true,
    });

    // Empty text is a valid outcome — a refusal, or a reasoning model that
    // spent its whole budget thinking. maybeEnrichRecommendation already
    // treats it as "keep the deterministic prose", so it degrades to
    // exactly today's product behaviour instead of surfacing an error.
    return Response.json({
      text: result.text,
      model: result.model,
      usage: {
        promptTokens: result.promptTokens,
        completionTokens: result.completionTokens,
      },
    });
  }),
};
