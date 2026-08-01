# Spec: hosted AI behind AIPort, via a Supabase Edge Function key proxy

**Status:** Implemented in 5.6.0, second upstream added in 5.7.0, live on the hosted project and smoke-verified end-to-end against Mistral (`AI_UPSTREAM=openai`). `ai_usage` is applied and `ai-generate` is deployed (v2, `verify_jwt` enabled). Only rollout step 4 is outstanding: `VITE_AI_PROVIDER` reaches the build in this PR, so until it merges the product path is unchanged.
**Scope:** One new Edge Function (`ai-generate`) with two interchangeable upstreams, one new adapter (`ProxyAIProvider`), one usage/quota table, env + secret wiring.
**Out of scope:** Changing simulation scoring, futures, ranking, or confidence. Streaming. Embeddings. Agent loops. Replacing Ollama or Noop.

---

## Why a proxy exists at all

Chronos ships as a **static SPA on GitHub Pages**. Every `VITE_*` value is inlined into the public bundle at build time — `dist/assets/*.js` is world-readable. A provider key in `VITE_ANTHROPIC_API_KEY` (or `VITE_GROQ_API_KEY`, or any other) is a published key, not a configured one. This is true of the free hosts too: a free key is still an abusable key once it is in the bundle.

So keys live as **Supabase secrets**, read only inside an Edge Function, and the browser never sees them.

```text
Browser (static SPA)                 Supabase Edge Function          Upstream (server's choice)
──────────────────────               ──────────────────────          ──────────────────────────
SimulationEngine
  └ maybeEnrichRecommendation()
      └ AIPort.generate()
          └ ProxyAIProvider ──POST /functions/v1/ai-generate──▶ withSupabase({auth:'user'})
             Authorization:          ├ quota + rate check (Postgres)      ┌─ AI_UPSTREAM=openai
             Bearer <session JWT>    ├ key from Deno.env ─────────────────┤    POST {AI_BASE_URL}
             (no vendor key)         ├ record usage                       │         /chat/completions
                                     └ { text, model, usage } ◀───────────┤  (Groq · Together ·
                                                                          │   OpenRouter · vLLM · …)
                                                                          └─ AI_UPSTREAM=anthropic
                                                                               POST /v1/messages
```

The port contract does not change. `AIPort` stays vendor-free; every vendor SDK and wire format lives only in the Edge Function, which is outside `src/` entirely — so `ARCHITECTURE.md`'s dependency rules are untouched. The browser cannot tell which upstream answered, and that is the point: model choice is an operational decision, not a bundle constant.

---

## Assumptions

1. The caller is always a **signed-in user**. Auth mode is therefore `auth: 'user'`, and `verify_jwt` stays at its default (enabled). Since `SPEC-anonymous-workspace.md` shipped, a workspace session is no longer necessarily authenticated: an anonymous visitor has no Supabase session, so `ProxyAIProvider` throws before the request is made and `maybeEnrichRecommendation` fails open to deterministic prose. That is the correct outcome — an anonymous id must never reach a cloud table, and the ledger attributes spend to a person — but it means **hosted enrichment reaches signed-in users only**, and anonymous visitors see the deterministic recommendation with no AI rewrite. Serving them would need a different quota subject, not a different auth mode.
2. The provider key is a Supabase secret, set by the repo owner. On a paid upstream **the owner pays for every call**; on a free tier the owner spends the account's rate limit instead. Either way the resource is exhaustible and attributable, which is why quotas are in v1 rather than a later slice.
3. AI remains **prose-only**. Scores, futures, risks, and confidence stay deterministic; `maybeEnrichRecommendation` is still fail-open.
4. Only `generate` is proxied in v1. `embed` throws `AICapabilityError`; `reason`/`code` delegate to `generate` (same shape as the Ollama adapter).
5. Requests are short (≈400 input tokens, ≤280 output). No streaming — the streaming threshold is `max_tokens` around 16000, three orders of magnitude away.

---

## Objective

| Goal | Detail |
|------|--------|
| Key safety | No provider key reaches the bundle, the network tab, or a `VITE_*` var |
| Bounded cost | Per-user and global caps enforced server-side before the upstream call |
| No behavior drift | `VITE_AI_PROVIDER` unset ⇒ noop ⇒ byte-identical sim output to today |
| Portability | `AIPort` unchanged; changing model or vendor is a secret, not a deploy |
| No vendor lock | Open weights and Anthropic are the same request from the client's side |

---

## Part 1 — Edge Function `ai-generate`

### Auth mode

`auth: 'user'`. The browser sends the Supabase session access token as `Authorization: Bearer <jwt>`; `@supabase/server` verifies it and hands back `ctx.user` plus a request-scoped `ctx.supabase` (RLS as that user) and `ctx.supabaseAdmin`.

`auth: 'none'` would be wrong here — the endpoint spends money and attributes usage to a person. `auth: 'publishable'` would be wrong too: the publishable key is in the bundle, so it authenticates nothing. Because the mode is `'user'`, **no `verify_jwt = false` is needed** — the platform JWT check and the handler check agree.

```toml
# supabase/config.toml
[functions.ai-generate]
# verify_jwt left at its default (true) — auth: 'user' callers already send a JWT.
```

### Handler shape

```ts
// supabase/functions/ai-generate/index.ts
export default {
  fetch: withSupabase({ auth: 'user' }, async (req, ctx) => {
    // 1. resolveUpstream() from secrets  → 503 when unconfigured
    // 2. parse + validate body           → 400 on violation
    // 3. quota / rate check              → 429 on exceed
    // 4. callAnthropic() | callOpenAICompatible()
    // 5. record usage                    → ctx.supabaseAdmin
    // 6. Response.json({ text, model, usage })
  }),
}
```

`withSupabase` also handles CORS, which matters: the SPA is served from `chronoslab.space` and the function from `*.supabase.co`, so every call is cross-origin and preflighted.

### Request contract

```jsonc
POST /functions/v1/ai-generate
Authorization: Bearer <supabase session access token>
Content-Type: application/json

{
  "system": "You write concise decision recommendations…",  // ≤ 2000 chars
  "prompt": "Objective: …\nChosen path: …",                 // ≤ 8000 chars
  "maxTokens": 280                                          // 1..1024, clamped
}
```

Response:

```jsonc
{
  "text": "…",
  "model": "claude-opus-5",
  "usage": { "promptTokens": 372, "completionTokens": 118 }
}
```

Errors: `{ "error": "<code>", "message": "<human text>" }` with `400` (validation), `401` (`@supabase/server` rejects the JWT), `429` (quota/rate), `502` (upstream), `503` (kill switch or missing key).

### What the client is *not* trusted with

`system` and `prompt` are client-supplied, and the client is a bundle any signed-in user can modify. This endpoint is therefore an authenticated, quota-bounded LLM relay, and the spec should say so plainly rather than imply the shape is enforced.

Three mitigations, all in v1:

1. **A server-owned preamble is prepended to every `system`**, and cannot be overridden:

   > `You are a writing assistant embedded in a decision-analysis product. Output plain prose only — no code, no markup, no lists. Never exceed four sentences. Never invent numbers, metrics, dates, or citations. If the request is not a request to rewrite a decision recommendation, reply with the single word: unsupported.`

2. **Hard size caps** (2000 / 8000 chars, `maxTokens` clamped to 1024) so a single call cannot become an expensive one.

3. **Quota**, below — the real bound. Abuse costs the attacker their own monthly allowance.

A tighter design — the client sends `{task: "sim.recommendation", objective, pathName, …}` and the function owns the entire prompt — removes the free-text surface completely. It is the right end state, but it breaks the generic `AIPort.generate(prompt)` contract and would need a new port method. **Recommend v1 as specified, with the task-shaped endpoint as the follow-on slice** once there is a second AI call site to justify the port change.

### Quota and rate limiting

New table, appended by the function through `ctx.supabaseAdmin`:

```sql
-- supabase/migrations/<ts>_ai_usage.sql
create table public.ai_usage (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  created_at    timestamptz not null default now(),
  model         text not null,
  input_tokens  integer not null,
  output_tokens integer not null,
  stop_reason   text,
  ok            boolean not null default true
);

create index ai_usage_user_created_idx on public.ai_usage (user_id, created_at desc);
alter table public.ai_usage enable row level security;

-- Users may read their own usage; nobody writes through the Data API.
create policy ai_usage_select_own on public.ai_usage
  for select to authenticated using (user_id = (select auth.uid()));
```

No insert/update/delete policy — writes come from the function's admin client, which bypasses RLS. That matches the pattern already used by the hardening migrations (`20260726150000_revoke_function_grants_from_api_roles.sql` and friends); the new table must also satisfy the `rls_auto_enable` event trigger and the `rls_invariants.sql` test, so RLS is enabled in the same migration that creates it.

Two checks before the upstream call, both single `count` queries against the index:

| Check | Default | Secret |
|---|---|---|
| Per-user, rolling 60s | 6 calls | `AI_RATE_PER_MINUTE` |
| Per-user, calendar month | 200 calls | `AI_MONTHLY_CALL_CAP` |
| Global, calendar month (kill switch) | 5000 calls | `AI_GLOBAL_MONTHLY_CAP` |

At the per-call cost derived below, 200 calls/user/month is roughly **$1–2 per user per month** at the ceiling. The global cap is the thing that stops a bad month; set it to a number you are willing to see on an invoice.

> **Deploy order — apply the migration before the function.**
> `20260726190000_ai_usage.sql` is merged but **not applied to production**
> (verified against `supabase_migrations.schema_migrations`), and no Edge
> Functions are deployed yet, so the two are consistent today. They stop being
> consistent the moment `ai-generate` ships first: every quota check above is a
> count against `ai_usage`, so without the table the function cannot refuse work
> before it spends money — the caps become unenforceable on a function that
> bills the project owner. Apply the migration, confirm the table exists, then
> deploy.

### Upstream selection

Chosen from secrets alone; the client has no say. An explicit `AI_UPSTREAM` wins, so having both key sets present while comparing them is never resolved by accident. Otherwise the upstream is inferred from whichever keys exist. Misconfiguration returns `503` with the specific missing secret named — the client turns that into a fail-open, so a half-configured deploy degrades to deterministic prose rather than breaking simulations.

| `AI_UPSTREAM` | Required secrets | Notes |
|---|---|---|
| `openai` | `AI_BASE_URL`, `AI_API_KEY`, `AI_MODEL` | Any OpenAI-compatible `/chat/completions` host |
| `anthropic` | `ANTHROPIC_API_KEY` | `ANTHROPIC_MODEL` optional, defaults to `claude-opus-5` |

`AI_MODEL` has **no default**. Every host names its models differently and the names churn; guessing one produces a 404 from inside a proxy, which is a miserable thing to debug. Take the exact string from the provider's current model list.

### Open-weights request shaping (`AI_UPSTREAM=openai`)

One wire format reaches essentially every open-weights host — Groq, Together, OpenRouter, Cerebras, Hugging Face's router, DeepInfra, Fireworks — and everything self-hosted behind vLLM, llama.cpp, LM Studio, or Ollama's OpenAI shim. Switching between them is a base URL and a model string.

```ts
POST {AI_BASE_URL}/chat/completions
Authorization: Bearer {AI_API_KEY}

{
  "model": AI_MODEL,
  "messages": [
    { "role": "system", "content": SERVER_PREAMBLE + clientSystem },
    { "role": "user",   "content": clientPrompt }
  ],
  "max_tokens": clampedMaxTokens,   // not max_completion_tokens — the older
                                    // name is what OSS servers still accept
  "temperature": 0.3,               // accepted here, unlike Opus 5
  "stream": false
}
```

Three response quirks the parser has to absorb, all of which have bitten real integrations:

1. **Inline chain-of-thought.** Qwen, DeepSeek-R1 distills, and several gpt-oss builds wrap their scratchpad in `<think>…</think>` and expect the caller to strip it. Left in, it renders to the user *as* the recommendation. Unterminated blocks (the model hit the ceiling mid-thought) are also truncated away.
2. **`content: null`.** Returned when a reasoning model spends its whole budget in `reasoning_content`, and on refusals. Not an error — it maps to empty text, which the engine already treats as "keep the deterministic prose".
3. **Errors inside a `200`.** Several hosts return `{"error": {...}}` with a success status. The parser checks for it explicitly rather than reading `choices[0]` off a body that has none.

`chatCompletionsUrl` accepts a bare base, a trailing slash, or the full endpoint pasted in — all three resolve to the same URL instead of a 404.

**These are the only parts of the function under automated test.** They live in `supabase/functions/_shared/openaiCompatible.ts`, deliberately free of Deno globals and dependencies, and are covered by vitest alongside the app. Response parsing is the piece most likely to break against a new provider, so it is the piece that should not rely on manual checking.

### Anthropic request shaping

Per the current Messages API — several of these differ from patterns that were correct a year ago, so they are spelled out:

```ts
const message = await anthropic.messages.create({
  model: Deno.env.get('ANTHROPIC_MODEL') ?? 'claude-opus-5',
  max_tokens: clampedMaxTokens,                 // caps thinking + text together
  system: SERVER_PREAMBLE + '\n\n' + clientSystem,
  messages: [{ role: 'user', content: clientPrompt }],
  output_config: { effort: 'low' },             // primary cost lever
  thinking: { type: 'disabled' },               // legal only at effort ≤ high
}, { timeout: 30_000 })                         // TS SDK timeout is MILLISECONDS
```

| Decision | Rationale |
|---|---|
| `claude-opus-5` | The default model. Not downgraded for cost — that is the owner's call, and `ANTHROPIC_MODEL` exists to make it a one-secret change. |
| `output_config: {effort: 'low'}` | The cost lever that actually applies here. `low` is unusually strong on Opus 5, and a 2–4 sentence rewrite of already-computed prose is not a reasoning task. |
| `thinking: {type: 'disabled'}` | Thinking is **on by default** on Opus 5 and would consume the same `max_tokens` budget as the answer. Disabling is permitted only at effort ≤ `high`; `low` qualifies. |
| **Drop `temperature`** | `maybeEnrichRecommendation` currently passes `temperature: 0.4`. Sampling params (`temperature`/`top_p`/`top_k`) are **rejected with a 400** on Opus 5. The adapter must not forward `req.temperature`. This is the single most likely first-run failure. |
| No `stream` | `max_tokens` ≤ 1024; streaming matters around 16000. |
| No `budget_tokens` | Removed on Opus 5 → 400. Adaptive thinking replaced it; here thinking is off entirely. |

**Refusals must be handled before reading content:**

```ts
if (message.stop_reason === 'refusal') {
  // Record usage, return 200 with text: "" — the engine's fail-open path
  // then keeps the deterministic recommendation. A refusal is not an error.
  return Response.json({ text: '', model: message.model, usage })
}
const text = message.content
  .filter((b) => b.type === 'text')
  .map((b) => b.text)
  .join('')
  .trim()
```

Returning `text: ""` rather than an error status is deliberate: `maybeEnrichRecommendation` already treats empty text as "keep the deterministic prose," so a refusal degrades to exactly the current product behavior.

**Server-side fallbacks: not in v1.** Opting in (`fallbacks: 'default'` plus the `server-side-fallback-2026-07-01` beta header) would move the call onto `client.beta.messages.create` and pair a beta header with a scalar form that 400s if mismatched with the array form. The payoff is rescuing a refused prose rewrite — which already degrades to the deterministic recommendation at no cost to the user. Not worth a beta surface that cannot be exercised in CI. Revisit if refusals show up in the ledger.

### Prompt caching — measure before adding it

Caching looks attractive (a fixed system preamble on every call) but the numbers say otherwise. The stable prefix is the server preamble plus the engine's fixed system line: **≈160 tokens**. Opus 5's cache minimum is **512 tokens** — half of what it used to be, and still three times the prefix. Below the minimum, `cache_control` is silently inert while cache *writes* carry a 25% premium.

So: **no `cache_control` in v1.** Revisit only if the preamble grows past 512 tokens, and verify with `usage.cache_read_input_tokens > 0` rather than assuming it engaged.

### Cost model — Anthropic upstream

Measured from the real prompt that `maybeEnrichRecommendation` builds today (`SimulationEngine.ts:426`) with a representative workspace:

| Segment | ~Tokens |
|---|---|
| Server preamble | 100 |
| Engine system line | 58 |
| Engine prompt (objective, goal, path, summary, recommendation, 4 risks, confidence) | 198 |
| **Input total** | **≈356** |
| Output, typical 3 sentences | ≈120 |
| Output, ceiling (`max_tokens`) | 280 |

At Opus 5 rates ($5 / MTok input, $25 / MTok output):

| Case | Input | Output | Per call |
|---|---|---|---|
| Typical | $0.0018 | $0.0030 | **$0.0048** |
| Ceiling | $0.0025 | $0.0070 | **$0.0095** |

So **roughly half a cent per simulation, one cent worst case** — about **$5 per 1,000 simulations**. The default 200-call user cap is ≈$1.90/user/month at the ceiling; the 5,000-call global cap is ≈$48/month.

These are estimates from character counts. **Before enabling a paid upstream in production, replace them with real numbers** from `anthropic.messages.countTokens({model, system, messages})` run against three or four actual saved simulations. That call is free and is the only honest way to set the caps.

### Cost model — open-weights upstream

Per-call cost is **$0** on a free tier, and on a paid open-weights host it is roughly an order of magnitude below the Anthropic figures above (typical open 70B-class serving runs in the tens of cents per million tokens rather than dollars). At ≈356 input and ≈120 output tokens, that puts a simulation in the fraction-of-a-cent range even when paying.

Three things worth being clear-eyed about before treating "free" as the answer:

- **Free tiers are revocable and rate-limited.** They are free *for you today*, not a guarantee. The rate limit is usually the binding constraint, not the price — which is exactly what `AI_RATE_PER_MINUTE` exists to stay under. Quota enforcement matters as much here as on a paid key.
- **Data handling differs, and this prompt carries strategy content.** The request includes the objective, the chosen path, its summary, the deterministic recommendation, and the risks — a user's actual decision material. Several free tiers log or train on prompts by default; some paid tiers on the same provider do not. Check the provider's policy before pointing this at a real workspace, and prefer a self-hosted endpoint (vLLM, llama.cpp, Ollama) when the content is sensitive. That path uses the identical three secrets.
- **Quality is genuinely adequate for this task.** A 2–4 sentence rewrite of prose that already exists is close to the easiest thing an LLM does. This is not the call that justifies a frontier model — which is precisely why it is a good place to start with open weights.

Because the client cannot see the upstream, switching between them is `supabase secrets set` and a redeploy. Nothing in the bundle changes.

### Secrets

Pick one upstream:

```bash
# A) Open weights over an OpenAI-compatible endpoint (free on several hosts)
supabase secrets set AI_UPSTREAM=openai
supabase secrets set AI_BASE_URL=https://api.groq.com/openai/v1   # or Together, OpenRouter,
supabase secrets set AI_API_KEY=...                               #   Cerebras, HF, your vLLM…
supabase secrets set AI_MODEL=<provider's model id>               # no default — see above

# B) Anthropic
supabase secrets set AI_UPSTREAM=anthropic
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
supabase secrets set ANTHROPIC_MODEL=claude-opus-5     # optional override
```

Quota, both upstreams:

```bash
supabase secrets set AI_RATE_PER_MINUTE=6              # optional
supabase secrets set AI_MONTHLY_CALL_CAP=200           # optional
supabase secrets set AI_GLOBAL_MONTHLY_CAP=5000        # optional kill switch (0 disables the function)
```

Never `VITE_`-prefixed. Never in `.env.production`. Never in `config.toml`. `SUPABASE_URL` and the key set are injected by the platform — `@supabase/server` resolves them with no configuration.

---

## Part 2 — `ProxyAIProvider` (client adapter)

> **Shipped as `ProxyAIProvider`, not `AnthropicAIProvider`.** This section was
> written when Anthropic was the assumed upstream. The adapter never names one:
> the model is a server secret, and the upstream actually configured is Mistral
> via the OpenAI-compatible path. The names below are kept as written so the
> reasoning stays readable — read `Anthropic*` as `Proxy*` throughout, and
> `readonly id = "anthropic"` as `readonly id = "proxy"`.

`src/infrastructure/ai/ProxyAIProvider.ts`, same shape as `OllamaAIProvider`:

```ts
export type AnthropicAIProviderOptions = {
  /** Defaults to `${VITE_SUPABASE_URL}/functions/v1/ai-generate`. */
  proxyUrl?: string;
  /** Injected so the adapter doesn't import the auth service. */
  getAccessToken: () => Promise<string | null>;
  fetchImpl?: typeof fetch;
};

export class AnthropicAIProvider implements AIPort {
  readonly id = "anthropic";
  async generate(req: GenerateRequest): Promise<GenerateResult>;
  async embed(): Promise<EmbedResult>;   // throws AICapabilityError
  async reason(req): Promise<GenerateResult>;  // system preamble + generate
  async code(req): Promise<GenerateResult>;    // system preamble + generate
}
```

Behavior:

- Reads the session token via the injected getter (wired at the composition root to `supabase.auth.getSession()`); **no token ⇒ throw `AIProviderError`**, which `maybeEnrichRecommendation` catches and fails open to deterministic prose. A signed-out user therefore sees today's behavior, not an error.
- Sends `{system, prompt, maxTokens}`. **Does not send `temperature`** — see the 400 note above. Does not send `model`; model selection is a server secret, so the bundle cannot pin an expensive one.
- Maps `429` to an `AIProviderError` with the retry hint intact; maps non-2xx to `AIProviderError` with status, matching `OllamaAIProvider.postJson`.
- Never throws on `text: ""` — returns it, and the engine keeps the deterministic recommendation.

Registration in `createAIPort.ts`:

```ts
export type AIProviderId = "noop" | "ollama" | "proxy" | "anthropic";
```

`proxy` is the honest id: with two upstreams the browser cannot know which vendor answered. `anthropic` is kept as an accepted alias and normalised to `proxy`, so configs written against 5.6.0 keep working. The `defaultProviderId` fallback already drops an unknown value to `noop`, so a typo in `VITE_AI_PROVIDER` degrades safely rather than breaking sims.

---

## Files

```text
SPEC-ai-proxy.md                                     # this document
supabase/functions/ai-generate/index.ts              # new — npm: specifiers pinned inline,
                                                     #   so no deno.json to drift out of sync
supabase/config.toml                                 # [functions.ai-generate]
supabase/migrations/20260726190000_ai_usage.sql      # table + RLS + indexes + grants
supabase/tests/rls_invariants.sql                    # extend: ai_usage has no API-role write path
supabase/functions/_shared/openaiCompatible.ts       # new — pure shaping/parsing, no Deno globals
supabase/functions/_shared/openaiCompatible.test.ts  # new — runs under vitest with the app
src/infrastructure/ai/ProxyAIProvider.ts             # new
src/infrastructure/ai/ProxyAIProvider.test.ts        # new (mocked fetch)
src/infrastructure/ai/createAIPort.test.ts           # new — registration, alias, fallback-to-noop
src/infrastructure/ai/createAIPort.ts                # + "proxy", proxy URL, token getter
vitest.config.ts / tsconfig.json / biome.json        # include supabase/functions/_shared
src/infrastructure/ai/index.ts                       # re-export
src/vite-env.d.ts                                    # VITE_AI_PROXY_URL
.env.example                                         # document the client var + the secret list
```

**The gates cover `_shared`, not `index.ts`.** `tsconfig.json`, `biome.json`, and `vitest.config.ts` were extended to include `supabase/functions/_shared/**`, which is pure TypeScript and safe to type-check, lint, and unit-test alongside the app. `supabase/functions/ai-generate/index.ts` stays outside all three because it uses Deno globals and `npm:` specifiers that the app toolchain cannot resolve. Deno type-checks it at `supabase functions deploy`, which is the real gate — run a local `supabase functions serve` before deploying rather than trusting a green CI badge.

---

## Env (client)

```bash
# Hosted generation via the Supabase Edge Function proxy.
# No provider key here, ever — every VITE_ value ships in the bundle.
# VITE_AI_PROVIDER=proxy
# VITE_AI_PROXY_URL=https://<ref>.supabase.co/functions/v1/ai-generate   # optional; derived from VITE_SUPABASE_URL
```

That is the entire client surface: which vendor, which model, and what it costs are all server-side. Default stays `noop`. Enabling this in production is a deliberate two-step: set the secrets, then flip the build var.

---

## Testing

| Test | Assert |
|---|---|
| `ProxyAIProvider` — happy path | Mocked fetch → maps `{text, model, usage}`; `Authorization: Bearer` present |
| `ProxyAIProvider` — no session | Throws `AIProviderError`; nothing sent |
| `ProxyAIProvider` — payload | Body is exactly `{system, prompt, maxTokens}` — **omits `temperature`** even when the request carries one, and omits `model` |
| `ProxyAIProvider` — 429 / 5xx | Throws `AIProviderError` with status and the proxy's own message |
| `ProxyAIProvider` — `text: ""` | Resolves with empty text, does not throw |
| `chatCompletionsUrl` | Bare base, trailing slash, and full endpoint all resolve identically; empty base throws |
| `buildChatCompletionBody` | System/user roles correct, `max_tokens` (not `max_completion_tokens`), never streams |
| `stripReasoning` | Closed, repeated, and unterminated `<think>` blocks removed; plain prose untouched |
| `parseChatCompletion` | Maps usage; `content: null` and empty `choices` → empty text; `{error}` inside a 200 throws; malformed usage → `0`, never `NaN` |
| `SimulationEngine` fail-open | Provider that throws ⇒ recommendation identical to deterministic output |
| `createAIPortFromEnv` | `proxy` resolves the adapter; legacy `anthropic` normalises to it; garbage falls back to `noop` |
| Edge Function (`supabase functions serve` + local stack) | Missing JWT ⇒ 401; oversize prompt ⇒ 400; cap exceeded ⇒ 429; happy path writes one `ai_usage` row |
| `rls_invariants.sql` | `ai_usage` has RLS enabled and exposes no write policy to `authenticated` |

Everything above the Edge Function row runs in CI. The Edge Function rows need Docker (`npm run supabase:start`) and a real key, so they run locally before deploy. CI keeps `VITE_AI_PROVIDER` unset, so the unit and e2e suites exercise the noop path exactly as they do today.

---

## Rollout

1. ~~Merge the function + adapter with `VITE_AI_PROVIDER` **unset**. Zero production change; the function is deployed but unreachable from the app.~~ **Done.**
2. ~~Owner picks an upstream and sets its secrets.~~ **Done** — Mistral, via the OpenAI-compatible upstream: `AI_UPSTREAM=openai`, `AI_BASE_URL=https://api.mistral.ai/v1`, `AI_MODEL=mistral-medium-latest`, `AI_API_KEY`. All four are Edge Function secrets, read per invocation by `resolveUpstream()`; none is a build value.
3. ~~`supabase db push` for `ai_usage`, then `supabase functions deploy ai-generate`.~~ **Done and fully smoke-verified** against the hosted project with a real session token: unauthenticated 401, malformed bearer 401, CORS preflight 204, oversize prompt 400, malformed JSON 400, seventh call in a minute 429 `rate_limited`, and a 200 returning `mistral-medium-latest` prose. Six `ai_usage` rows landed with correct `user_id`, model, and token counts. The 503 `service_disabled` path was observed for real before the secrets were set — worth noting that `resolveUpstream()` short-circuits ahead of body parsing and the quota counters, so an unconfigured deployment can only ever answer 503.
4. Flip `VITE_AI_PROVIDER=proxy` in the GitHub Actions build env — a plain value in the `env:` block of `deploy-pages.yml`, not a secret. **This PR.** Watch `ai_usage` for a week.
5. If moving to a paid upstream later, run `messages.countTokens` against three saved simulations first and replace the estimated caps with measured ones.
6. Rollback is unsetting one build var — the deterministic path never went away.

---

## Boundaries

**Always:** Keys server-side only. Quota checked before the upstream call. Fail-open to deterministic prose. `AIPort` stays vendor-free. Reasoning traces stripped before anything reaches the user.
**Ask first:** Raising the caps. Changing the upstream or model. Pointing a free tier that trains on prompts at real workspace content. Adding a second AI call site. Turning off the global kill switch.
**Never:** A provider key in any `VITE_` var. `auth: 'none'` on this function. Letting AI touch scores, futures, ranking, or confidence. Forwarding `temperature` to Anthropic.

---

## Success criteria

1. `SPEC-ai-proxy.md` committed and approved.
2. `ai-generate` deployed; unauthenticated call returns 401, oversize call returns 400, over-cap call returns 429.
3. `ProxyAIProvider` registered; `VITE_AI_PROVIDER=proxy` produces a polished recommendation end-to-end on both upstreams.
4. `VITE_AI_PROVIDER` unset ⇒ sim output byte-identical to today; full unit + e2e suite green.
5. Real usage recorded in `ai_usage`; on a paid upstream, within 2× of the estimate above — or this document updated with the measured figure.

---

## Later slices (not this PR)

- Task-shaped endpoint (`{task, fields}`) that removes the free-text relay surface.
- In-browser inference (WebGPU) for a genuinely key-free, request-free path — no proxy, no quota, no third party seeing the prompt. Costs a large model download and rules out most mobile, so it is an option, not a replacement.
- `embed` via the proxy, once retrieval over knowledge actually needs vectors.
- Prompt caching, if the stable prefix ever clears 512 tokens.
- A usage panel in the workspace reading `ai_usage` under its select-own policy.
