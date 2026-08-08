# Spec: the first LLM-backed capability

**Status:** Shipped. `cap-plan` runs through `application/agent-os` on the
`planChosenPath` → post-collapse path, labels `source: "ai" | "stub"`, and
fails open to the stub. `roadmap.build` / `cap-roadmap` are superseded — see
below.

Follows `SPEC-platform-ai.md` ("Later slices → Agent runtime calling `AI.reason`")
and `SPEC-ai-proxy.md` (how a hosted key is reached). Those cover the *provider*.
This covers the *seam*: how an LLM becomes a task capability without touching the
decision engine.

---

## Principle

The engine decides. The LLM writes prose about what the engine decided.

Chronos sells determinism — same input, same futures, same ranking. An LLM in the
ranking path destroys that claim, and the claim is the product. So the LLM
registers as a **task capability handler**, which is a layer the engine never
consults when it forks, evaluates, or collapses.

---

## Why the seam already exists

`AgentOperatingSystem` pairs metadata with an executor:

```ts
register(capability: CapabilityRegistration, handler: TaskHandler)
type TaskHandler = (task: Task) => Promise<Record<string, unknown>>
```

`CapabilityRegistration` (`domain/chronos/task-os.ts`) is pure metadata — id,
provider, version, `taskKinds`, `supports()`. It declares; it does not execute.
Execution rides alongside as the second argument. Registering an LLM therefore
needs **no change to the registration contract** — only a new handler.

`AIPort` (`domain/ai/AIPort.ts`) is already the provider-agnostic interface, and
`createAIPortFromEnv()` already resolves it from env. Nothing new is needed at the
provider layer either.

---

## Which capability goes first

`plan` (`cap-plan`), currently registered with the description *"Acknowledges plan
tasks (stub executor — no external side effects)."*

It is the right first slice because:

- It is already an explicit, honest stub with a live registration — the slot is
  wired, only the body is empty.
- It produces **prose, not order**. It ranks nothing, so it cannot violate the
  engine-owned-ranking invariant even by accident.
- It sits outside `run()` — `AgentSimulationRunner` is documented as *"pure
  application logic — no I/O"* and stays that way.

**Not** `roadmap.build` (`cap-roadmap`, "no code generation in beta"). Code
generation is a larger surface with its own review and safety questions; it should
not be the slice that establishes the pattern.

> **Superseded.** `roadmap.build` and `cap-roadmap` were retired entirely — the
> capability resolved to a handler that returned nothing, so the plan advertised
> a step Chronos could not take. The reasoning above still holds for code
> generation as a surface; it no longer describes anything in the registry.

---

## The pattern to copy

`src/agents/research/index.ts` is the working precedent, and the new handler should
mirror it exactly:

1. **Guard on noop.** `if (!isNoop(this.ai) && prompt)` — with no provider
   configured, never attempt a call.
2. **Fail open.** `catch { /* fall through to stub */ }`. An upstream outage
   degrades to deterministic text; it never fails a task.
3. **Empty output is failure.** A blank completion falls through to the stub
   rather than returning an empty result as success.
4. **Label the source.** Every payload carries `source: "ai" | "stub"` plus
   `model` and `provider`. This is what keeps the honesty claims checkable rather
   than aspirational.
5. **Inject, default to noop.** `constructor(private readonly ai: AIPort = new
   NoopAIProvider())` — tests get a fake, production gets env.

A handler that copies all five is correct by construction. One that skips (4)
silently breaks the docs-honesty invariant.

---

## Invariants this must not break

From `CLAUDE.md`, in the order they are most likely to be violated:

| Invariant | How this slice respects it |
|---|---|
| **Determinism** — same input → identical futures, scores, ranking | The LLM runs in a task handler, never in `SimulationEngine` or `engine.ts`. No unseeded randomness enters the engine path. |
| **Ranking is engine-owned** | `plan` emits no ordering. Nothing it returns feeds collapse order or `DecisionRanked`. |
| **Honest claims** — public simulate and Forge/Oracle/Atlas do not call an LLM | This registers on the workspace task graph only. The public simulator and the three scripted scenarios are untouched, and the capability registry already reports `source` per call. |
| **Missing env must not crash** | Noop is the default `AIPort`; no configuration means stub output, not an error. |

`SPEC-platform-ai.md` Boundaries already say **"Ask first: calling LLM inside
`run()` by default."** This slice does not, and should not be extended to.

---

## Testing

- **Unit, stub path:** noop `AIPort` → `source: "stub"`, deterministic text.
- **Unit, ai path:** fake `AIPort` returning fixed text → `source: "ai"`, model
  and provider surfaced.
- **Unit, fail-open:** `AIPort` that throws → resolves to the stub, `ok: true`.
- **Unit, empty completion:** returns `""` → falls through to stub, not success.
- **Invariant test:** a simulation run with an LLM-backed registry produces the
  **same ranking** as one with a noop registry. This is the test that would have
  caught the failure mode this spec exists to prevent, and it belongs beside
  `SimulationEngine.invariants.test.ts`.

Tests assert decision *outcomes*, not prompt shape — a test that asserts the
prompt string is a test of the prompt, not the product.

---

## Boundaries

**Always:** default noop; fail open; label `source`; engine path untouched.
**Ask first:** any second capability; anything that returns an ordering; spending
against a hosted key by default.
**Never:** LLM inside `run()`; LLM output re-ranking futures; a capability that
reports `source: "ai"` for stub output.

---

## Success criteria

1. `cap-plan` returns real prose when an `AIPort` is configured, stub otherwise.
2. `source` is accurate in every payload, both paths.
3. Ranking is byte-identical with and without the provider (invariant test green).
4. `npx tsc --noEmit`, `npx biome ci .`, unit and E2E all green.
5. Docs honesty: `ARCHITECTURE.md` implementation-status table updated so `plan`
   is no longer listed as a stub.

---

## Later slices (not this one)

- Code generation (the `roadmap.build` capability that once held its place is
  retired — see above)
- ~~Task-shaped endpoint~~ **Shipped (5.14.0)** — see `SPEC-ai-proxy.md`.
- ~~Multi-capability task graphs where one handler's output feeds another's
  input~~ **Shipped (#112):** `application/agent-os/runCapabilityChain.ts` is
  the generic runner; `researchDecision` → `planChosenPath` is the live
  instance (`researchContext` field), wired in `WorkspaceContext.chooseBestPath`
  off the latest research note. Prose only — never on the ranking path.
- Usage surfacing from `ai_usage` (needs the migration applied first — see
  `SPEC-ai-proxy.md` deploy-order note)
