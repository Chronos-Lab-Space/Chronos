# Spec: Anthropic provider behind AIPort, via a Supabase Edge Function key proxy

**Status:** Implemented in 5.6.0, dormant. The function and adapter are in the tree; `VITE_AI_PROVIDER` is unset, so the product path is unchanged. Steps 2–4 of the rollout below are still outstanding and need the key.
**Scope:** One new Edge Function (`ai-generate`), one new adapter (`AnthropicAIProvider`), one usage/quota table, env + secret wiring.
**Out of scope:** Changing simulation scoring, futures, ranking, or confidence. Streaming. Embeddings. Agent loops. Replacing Ollama or Noop.

---

## Why a proxy exists at all

Chronos ships as a **static SPA on GitHub Pages**. Every `VITE_*` value is inlined into the public bundle at build time — `dist/assets/*.js` is world-readable. An Anthropic API key in `VITE_ANTHROPIC_API_KEY` is a published key, not a configured one.

So the key lives as a **Supabase secret**, read only inside an Edge Function, and the browser never sees it. There is no `supabase/functions/` directory today; this is the first one.

```text
Browser (static SPA)                 Supabase Edge Function            Anthropic
──────────────────────               ──────────────────────            ─────────
SimulationEngine
  └ maybeEnrichRecommendation()
      └ AIPort.generate()
          └ AnthropicAIProvider ──POST /functions/v1/ai-generate──▶ withSupabase({auth:'user'})
             Authorization:            ├ quota + rate check (Postgres)
             Bearer <session JWT>      ├ ANTHROPIC_API_KEY (Deno.env) ──▶ POST /v1/messages
             (no vendor key)           ├ record usage
                                       └ { text, model, usage } ◀────────┘
```

The port contract does not change. `AIPort` stays vendor-free; the vendor SDK lives only in the Edge Function, which is outside `src/` entirely — so `ARCHITECTURE.md`'s dependency rules are untouched.

---

## Assumptions

1. The caller is always a **signed-in user** — `maybeEnrichRecommendation` only runs inside an authenticated workspace session. Auth mode is therefore `auth: 'user'`, and `verify_jwt` stays at its default (enabled).
2. The Anthropic key is a Supabase secret (`supabase secrets set ANTHROPIC_API_KEY=...`), set by the repo owner. **The owner pays for every call.** That is the entire reason quotas are in v1 rather than a later slice.
3. AI remains **prose-only**. Scores, futures, risks, and confidence stay deterministic; `maybeEnrichRecommendation` is still fail-open.
4. Only `generate` is proxied in v1. `embed` throws `AICapabilityError`; `reason`/`code` delegate to `generate` (same shape as the Ollama adapter).
5. Requests are short (≈400 input tokens, ≤280 output). No streaming — the streaming threshold is `max_tokens` around 16000, three orders of magnitude away.

---

## Objective

| Goal | Detail |
|------|--------|
| Key safety | Anthropic key never reaches the bundle, network tab, or a `VITE_*` var |
| Bounded cost | Per-user and global caps enforced server-side before the upstream call |
| No behavior drift | `VITE_AI_PROVIDER` unset ⇒ noop ⇒ byte-identical sim output to today |
| Portability | `AIPort` unchanged; swapping providers stays a one-env-var change |

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
import { withSupabase } from 'npm:@supabase/server'
import Anthropic from 'npm:@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY')! })

export default {
  fetch: withSupabase({ auth: 'user' }, async (req, ctx) => {
    // 1. parse + validate body   → 400 on violation
    // 2. quota / rate check      → 429 on exceed
    // 3. anthropic.messages.create(...)
    // 4. record usage            → ctx.supabaseAdmin
    // 5. Response.json({ text, model, usage })
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

### Cost model

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

These are estimates from character counts. **Before enabling the provider in production, replace them with real numbers** from `anthropic.messages.countTokens({model, system, messages})` run against three or four actual saved simulations. That call is free and is the only honest way to set the caps.

### Secrets

```bash
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...      # required — owner supplies
supabase secrets set ANTHROPIC_MODEL=claude-opus-5     # optional override
supabase secrets set AI_RATE_PER_MINUTE=6              # optional
supabase secrets set AI_MONTHLY_CALL_CAP=200           # optional
supabase secrets set AI_GLOBAL_MONTHLY_CAP=5000        # optional kill switch (0 disables the function)
```

Never `VITE_`-prefixed. Never in `.env.production`. Never in `config.toml`. `SUPABASE_URL` and the key set are injected by the platform — `@supabase/server` resolves them with no configuration.

---

## Part 2 — `AnthropicAIProvider` (client adapter)

`src/infrastructure/ai/AnthropicAIProvider.ts`, same shape as `OllamaAIProvider`:

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
export type AIProviderId = "noop" | "ollama" | "anthropic";
```

with `anthropic` added to the `providers` record. The `defaultProviderId` fallback logic already handles an unknown value by dropping to `noop`, so a typo in `VITE_AI_PROVIDER` degrades safely rather than breaking sims.

---

## Files

```text
SPEC-ai-proxy.md                                     # this document
supabase/functions/ai-generate/index.ts              # new — npm: specifiers pinned inline,
                                                     #   so no deno.json to drift out of sync
supabase/config.toml                                 # [functions.ai-generate]
supabase/migrations/20260726190000_ai_usage.sql      # table + RLS + indexes + grants
supabase/tests/rls_invariants.sql                    # extend: ai_usage has no API-role write path
src/infrastructure/ai/AnthropicAIProvider.ts         # new
src/infrastructure/ai/AnthropicAIProvider.test.ts    # new (mocked fetch)
src/infrastructure/ai/createAIPort.test.ts           # new — registration + fallback-to-noop
src/infrastructure/ai/createAIPort.ts                # + "anthropic", proxy URL, token getter
src/infrastructure/ai/index.ts                       # re-export
src/vite-env.d.ts                                    # VITE_AI_PROXY_URL
.env.example                                         # document the client var + the secret list
```

**Neither gate covers the Edge Function.** `tsconfig.json` includes only `src` and `vite.config.ts`; Biome's `files.includes` covers `src/**`, `e2e/**`, `scripts/**` and root files. `supabase/functions/**` falls outside both, so `tsc --noEmit` and `biome ci .` say nothing about it. Deno type-checks it at `supabase functions deploy`, which is the real gate — run a local `supabase functions serve` before deploying rather than trusting a green CI badge.

---

## Env (client)

```bash
# Hosted Anthropic via the Supabase Edge Function proxy.
# The API key is a Supabase secret — never a VITE_ var.
# VITE_AI_PROVIDER=anthropic
# VITE_AI_PROXY_URL=https://<ref>.supabase.co/functions/v1/ai-generate   # optional; derived from VITE_SUPABASE_URL
```

Default stays `noop`. Enabling this in production is a deliberate two-step: set the secret, then flip the build var.

---

## Testing

| Test | Assert |
|---|---|
| `AnthropicAIProvider` — happy path | Mocked fetch → maps `{text, model, usage}`; `Authorization: Bearer` present |
| `AnthropicAIProvider` — no session | Throws `AIProviderError`; nothing sent |
| `AnthropicAIProvider` — payload | Body contains `system`/`prompt`/`maxTokens` and **omits `temperature`** even when the request carries one |
| `AnthropicAIProvider` — 429 / 5xx | Throws `AIProviderError` with status |
| `AnthropicAIProvider` — `text: ""` | Resolves with empty text, does not throw |
| `SimulationEngine` fail-open | Provider that throws ⇒ recommendation identical to deterministic output |
| `createAIPortFromEnv` | `VITE_AI_PROVIDER=anthropic` resolves the adapter; garbage value falls back to `noop` |
| Edge Function (`supabase functions serve` + local stack) | Missing JWT ⇒ 401; oversize prompt ⇒ 400; cap exceeded ⇒ 429; happy path writes one `ai_usage` row |
| `rls_invariants.sql` | `ai_usage` has RLS enabled and exposes no write policy to `authenticated` |

The Edge Function tests need Docker (`npm run supabase:start`) and a real key, so they are **not** part of the CI gate; they run locally before deploy. CI keeps `VITE_AI_PROVIDER` unset, so the existing 242 unit tests and the e2e suite exercise the noop path exactly as they do today.

---

## Rollout

1. Merge the function + adapter with `VITE_AI_PROVIDER` **unset**. Zero production change; the function is deployed but unreachable from the app.
2. Owner sets `ANTHROPIC_API_KEY`. Run `messages.countTokens` against three saved simulations; replace the estimated caps above with measured ones.
3. `supabase functions deploy ai-generate`. Smoke-test with a real session token and confirm one `ai_usage` row.
4. Flip `VITE_AI_PROVIDER=anthropic` in the GitHub Actions build env. Watch `ai_usage` for a week.
5. Rollback is unsetting one build var — the deterministic path never went away.

---

## Boundaries

**Always:** Key server-side only. Quota checked before the upstream call. Fail-open to deterministic prose. `AIPort` stays vendor-free.
**Ask first:** Raising the caps. Changing `ANTHROPIC_MODEL`. Adding a second AI call site. Turning off the global kill switch.
**Never:** `VITE_ANTHROPIC_API_KEY`. `auth: 'none'` on this function. Letting AI touch scores, futures, ranking, or confidence. Forwarding `temperature`.

---

## Success criteria

1. `SPEC-ai-proxy.md` committed and approved.
2. `ai-generate` deployed; unauthenticated call returns 401, oversize call returns 400, over-cap call returns 429.
3. `AnthropicAIProvider` registered; `VITE_AI_PROVIDER=anthropic` produces a polished recommendation end-to-end.
4. `VITE_AI_PROVIDER` unset ⇒ sim output byte-identical to today; full unit + e2e suite green.
5. Real per-call cost recorded in `ai_usage` and within 2× of the estimate above — or this document updated with the measured figure.

---

## Later slices (not this PR)

- Task-shaped endpoint (`{task, fields}`) that removes the free-text relay surface.
- `embed` via the proxy, once retrieval over knowledge actually needs vectors.
- Prompt caching, if the stable prefix ever clears 512 tokens.
- A usage panel in the workspace reading `ai_usage` under its select-own policy.
