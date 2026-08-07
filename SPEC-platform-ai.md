# Spec: Platform AI — capability interface + provider router

**Status:** Shipped (slice 1) — AIPort, ProviderRouter, Noop default, Ollama + Proxy adapters. Hosted path is `VITE_AI_PROVIDER=proxy` → `ai-generate` (see `SPEC-ai-proxy.md`).  
**Scope:** Provider-agnostic **capability port** + **router** + first adapters (**Noop**, **Ollama**).  
**Out of scope:** Multi-agent runtime, coding agent loop, OpenAI/Qwen/OpenRouter adapters, changing deterministic sim scoring.

## Principle

Chronos decision engines **never** import a model vendor. They request capabilities:

```text
AI.generate() · AI.embed() · AI.reason() · AI.code()
```

The **ProviderRouter** maps capability → adapter. Default production path remains **Noop** so public beta sims stay deterministic and offline-safe.

```text
SimulationEngine / future agents
            │
            ▼
         AIPort (interface)
            │
            ▼
      ProviderRouter
     ┌──────┼──────┐
     ▼      ▼      ▼
   Noop  Ollama  (later: OpenAI, Qwen, OpenRouter)
```

AI sits **below** simulation / decision logic. Engines work without a live model.

---

## Assumptions

1. Browser SPA may call Ollama only when `VITE_AI_PROVIDER=ollama` and CORS allows `localhost:11434`.  
2. Default `VITE_AI_PROVIDER` / unset = **noop**.  
3. `SimulationEngine` accepts an injected `AIPort`; default factory returns router configured from env.  
4. **Current sim outputs must not change** under Noop (no LLM in the hot path when noop).  
5. Ollama HTTP API: `POST /api/generate` (non-stream for v1).

---

## Objective

| Goal | Detail |
|------|--------|
| Portability | Swap providers without touching `SimulationEngine` scoring |
| Safety | Beta ships with Noop; Ollama opt-in |
| Testability | Unit-test Noop + router; Ollama with mocked `fetch` |

---

## API (TypeScript)

```ts
// Capability requests (minimal v1)
type GenerateRequest = {
  prompt: string;
  system?: string;
  model?: string;       // override adapter default
  temperature?: number;
  maxTokens?: number;
};

type GenerateResult = {
  text: string;
  model: string;
  provider: string;
  usage?: { promptTokens?: number; completionTokens?: number };
};

type EmbedRequest = { input: string | string[]; model?: string };
type EmbedResult = { vectors: number[][]; model: string; provider: string };

type ReasonRequest = GenerateRequest & { schemaHint?: string };
type CodeRequest = GenerateRequest & { language?: string };

interface AIPort {
  readonly id: string;
  generate(req: GenerateRequest): Promise<GenerateResult>;
  embed(req: EmbedRequest): Promise<EmbedResult>;
  reason(req: ReasonRequest): Promise<GenerateResult>;
  code(req: CodeRequest): Promise<GenerateResult>;
}
```

**v1 semantics**

| Method | Behavior |
|--------|----------|
| `generate` | Primary completion |
| `embed` | Vectors; Noop returns `[]`; Ollama uses `/api/embeddings` if available, else throws typed unsupported |
| `reason` | Defaults to `generate` with optional system preamble |
| `code` | Defaults to `generate` with code-oriented system line |

Unsupported capability → throw `AICapabilityError` (not silent hang).

---

## Adapters

### NoopAIProvider (`id: "noop"`)

- `generate` / `reason` / `code` → `{ text: "", model: "noop", provider: "noop" }`  
- `embed` → `{ vectors: [], model: "noop", provider: "noop" }`  
- Never throws for normal calls; never hits network  

### OllamaAIProvider (`id: "ollama"`)

| Setting | Env | Default |
|---------|-----|---------|
| Base URL | `VITE_OLLAMA_URL` or `OLLAMA_HOST` | `http://127.0.0.1:11434` |
| Model | `VITE_OLLAMA_MODEL` | `llama3.2:1b` |

- `generate`: `POST {base}/api/generate` body `{ model, prompt, system, stream: false, options: { temperature } }`  
- Map response `response` → `text`  
- Network/4xx/5xx → throw `AIProviderError` with message  

### ProviderRouter

- Constructed with `Map` or record of adapters + `defaultProviderId`  
- `route(capability)` uses default unless request overrides provider later (v1: default only)  
- Implements `AIPort` by delegating to selected adapter  

### Factory `createAIPortFromEnv()` / `getDefaultAIPort()`

```text
VITE_AI_PROVIDER=noop|ollama   (default noop)
```

Singleton ok for SPA; tests inject fresh instances.

---

## SimulationEngine wiring

```ts
constructor(
  private readonly planner = new StartupLaunchPlanner(),
  private readonly ai: AIPort = getDefaultAIPort()
) {}
```

- **Noop default:** `run()` behavior **identical** to pre-AI (deterministic path only).  
- **Opt-in enrich:** `VITE_AI_SIM_ENRICH=true` + non-noop provider → `maybeEnrichRecommendation()` rewrites **recommendation prose only** (fail-open). Futures/scores unchanged.  
- Unit test: `new SimulationEngine(planner, noop).run(...)` still passes; enrich tests cover flag off/on.

---

## Project structure

```text
SPEC-platform-ai.md
src/domain/ai/
  types.ts
  errors.ts
  AIPort.ts
src/infrastructure/ai/
  NoopAIProvider.ts
  OllamaAIProvider.ts
  ProviderRouter.ts
  createAIPort.ts
  index.ts
  NoopAIProvider.test.ts
  ProviderRouter.test.ts
  OllamaAIProvider.test.ts
src/application/simulation/SimulationEngine.ts  # inject AIPort
src/vite-env.d.ts                               # VITE_AI_* / VITE_OLLAMA_*
.env.example                                    # document vars
```

Domain owns contracts; infrastructure owns HTTP. Application depends on `AIPort` only.

---

## Env (document in `.env.example`)

```bash
# Platform AI (default noop — deterministic sims)
# VITE_AI_PROVIDER=noop
# VITE_AI_PROVIDER=ollama
# VITE_OLLAMA_URL=http://127.0.0.1:11434
# VITE_OLLAMA_MODEL=llama3.2:1b
```

---

## Testing

| Test | Assert |
|------|--------|
| Noop | generate returns empty text; embed empty vectors |
| Router | delegates to configured default |
| Ollama | mock fetch → maps `response`; error path throws |
| SimulationEngine | existing tests still pass with default Noop |

---

## Boundaries

**Always:** No vendor imports in domain/application; default Noop; existing sim tests green.  
**Ask first:** Calling LLM inside `run()` by default; adding paid providers.  
**Never:** Hardcode OpenAI keys in SPA; block sim on Ollama down when Noop.

---

## Success criteria

1. `SPEC-platform-ai.md` committed  
2. `AIPort` + Noop + Ollama + Router + factory  
3. `SimulationEngine` accepts `AIPort`, default Noop, **no behavior change** on current product path  
4. Unit tests for Noop/Router/Ollama (mocked)  
5. `tsc` + existing sim unit tests green  

---

## Later slices (not this PR)

> **All four shipped, none as a dedicated adapter class.** `ai-generate`
> (`SPEC-ai-proxy.md`) is the server-side proxy this list anticipated, and its
> `AI_UPSTREAM=openai` path (`supabase/functions/_shared/openaiCompatible.ts`)
> already covers "any OpenAI-compatible host" — Groq, Together, OpenRouter,
> Cerebras, self-hosted, and others — by base URL + model name, not by a new
> client-side class per provider. `stripReasoning()` in that shared module
> already strips Qwen's `<think>` blocks specifically. A hosted key must stay
> server-side regardless (`ProxyAIProvider`'s own docstring: "a browser-held
> provider key would ship in `dist/` on the first build"), so a per-provider
> browser adapter was never the right shape for this one. `VITE_AI_SIM_ENRICH`
> shipped in `createAIPort.ts`; the agent runtime calling `AI.reason` shipped
> as `cap-plan` (`SPEC-llm-capability.md`, marked shipped).

- OpenAI / OpenRouter / Qwen adapters  
- `VITE_AI_SIM_ENRICH` optional thesis draft  
- Agent runtime calling `AI.reason`  
- Server-side proxy if browser CORS blocks Ollama  
