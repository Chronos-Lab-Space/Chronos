// ============================================================
// ai-generate — Anthropic key proxy for the Chronos SPA
//
// Chronos ships as a static bundle on GitHub Pages, so every VITE_* value
// is public. The Anthropic key therefore lives here, as a Supabase secret
// read from Deno.env, and the browser only ever holds its own session JWT.
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

/** Model default. Override with the ANTHROPIC_MODEL secret, not from the client. */
const DEFAULT_MODEL = "claude-opus-5";

/** Upstream timeout. The SDK takes milliseconds. */
const UPSTREAM_TIMEOUT_MS = 30_000;

const MAX_SYSTEM_CHARS = 2_000;
const MAX_PROMPT_CHARS = 8_000;
const MAX_OUTPUT_TOKENS = 1_024;
const DEFAULT_OUTPUT_TOKENS = 280;

/**
 * Prepended to every client `system`, never overridable.
 *
 * `system` and `prompt` arrive from a bundle any signed-in user can edit,
 * so this endpoint is an authenticated relay bounded by quota rather than
 * by shape. This preamble is the cheap part of that bound; the caps and
 * the ledger are the rest. SPEC-ai-proxy.md names the task-shaped
 * endpoint that would close the free-text surface entirely.
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

  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  if (!prompt) return "`prompt` is required.";
  if (prompt.length > MAX_PROMPT_CHARS) {
    return `\`prompt\` exceeds ${MAX_PROMPT_CHARS} characters.`;
  }

  const system = typeof body.system === "string" ? body.system.trim() : "";
  if (system.length > MAX_SYSTEM_CHARS) {
    return `\`system\` exceeds ${MAX_SYSTEM_CHARS} characters.`;
  }

  // Clamp rather than reject: an out-of-range value is a client bug, not
  // an attack, and the ceiling is what actually bounds the spend.
  let maxTokens = DEFAULT_OUTPUT_TOKENS;
  if (body.maxTokens != null) {
    const n = Number(body.maxTokens);
    if (!Number.isFinite(n) || n < 1) return "`maxTokens` must be a positive number.";
    maxTokens = Math.min(Math.floor(n), MAX_OUTPUT_TOKENS);
  }

  return { system, prompt, maxTokens };
}

function startOfMonthISO(now: Date): string {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
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

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) {
      // Deployed without a key: behave like a disabled feature, not a
      // crash. The client maps this to an AIProviderError and the engine
      // keeps its deterministic recommendation.
      return fail(503, "service_disabled", "AI provider is not configured.");
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
    const model = Deno.env.get("ANTHROPIC_MODEL") ?? DEFAULT_MODEL;
    const anthropic = new Anthropic({ apiKey });
    const system = parsed.system ? `${SERVER_PREAMBLE}\n\n${parsed.system}` : SERVER_PREAMBLE;

    const message = await anthropic.messages
      .create(
        {
          model,
          max_tokens: parsed.maxTokens,
          system,
          messages: [{ role: "user", content: parsed.prompt }],
          // The cost lever that applies here: rewriting settled prose is
          // not a reasoning task, and `low` is strong on Opus 5.
          output_config: { effort: "low" },
          // Thinking is ON by default on Opus 5 and would share this
          // request's max_tokens with the answer. `disabled` is accepted
          // only at effort `high` or lower, so `low` qualifies.
          thinking: { type: "disabled" },
          // No temperature / top_p / top_k — removed on Opus 5, 400 if sent.
          // No stream — max_tokens is three orders below where it matters.
        },
        { timeout: UPSTREAM_TIMEOUT_MS }
      )
      .catch((err: unknown) => (err instanceof Error ? err : new Error(String(err))));

    if (message instanceof Error) {
      await recordUsage({
        userId,
        model,
        inputTokens: 0,
        outputTokens: 0,
        stopReason: "error",
        ok: false,
      });
      return fail(502, "upstream_failed", `Anthropic request failed: ${message.message.slice(0, 200)}`);
    }

    const usage = {
      promptTokens: message.usage?.input_tokens ?? 0,
      completionTokens: message.usage?.output_tokens ?? 0,
    };

    await recordUsage({
      userId,
      model: message.model ?? model,
      inputTokens: usage.promptTokens,
      outputTokens: usage.completionTokens,
      stopReason: message.stop_reason ?? null,
      ok: true,
    });

    // Refusals are read before the content blocks. Returning empty text
    // with a 200 is deliberate: maybeEnrichRecommendation already treats
    // empty text as "keep the deterministic prose", so a refusal degrades
    // to exactly today's product behaviour instead of surfacing an error.
    if (message.stop_reason === "refusal") {
      return Response.json({ text: "", model: message.model, usage });
    }

    const text = message.content
      .map((block) => (block.type === "text" ? block.text : ""))
      .join("")
      .trim();

    return Response.json({ text, model: message.model, usage });
  }),
};
