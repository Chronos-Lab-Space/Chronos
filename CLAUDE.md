# CLAUDE.md

Operational guide for Claude Code in this repo. Product/agent context lives in
[`AGENTS.md`](./AGENTS.md); architecture in [`ARCHITECTURE.md`](./ARCHITECTURE.md);
accepted risk exceptions in [`SECURITY.md`](./SECURITY.md). This file covers how
to *work* here — commands, invariants, and traps that have already cost time.

## Commands

```bash
npm run dev            # vite dev server
npm run build          # vite build + GH Pages 404.html fallback
npm run lint           # biome check .        (lint:fix / format to write)
npm run test:unit      # vitest run
npm run test:e2e       # playwright (needs: npx playwright install)
npm run supabase:start # local stack, lean profile
npm run supabase:reset # replay every migration from scratch
npm run supabase:env   # write .env from supabase status
npx tsc --noEmit       # typecheck
```

Before pushing, run what CI runs: `npx tsc --noEmit && npx biome ci . && npm run
test:unit && npm run test:e2e`.

## CI

| Workflow | Gates |
|---|---|
| `playwright-e2e.yml` | typecheck → `biome ci .` → unit → E2E, on every PR |
| `supabase-migrations.yml` | replays all migrations on a clean stack, then asserts `supabase/tests/rls_invariants.sql` + `rls_access_matrix.sql` |
| `deploy-pages.yml` | typecheck → build → GitHub Pages, on `main` |

`biome ci` fails on **errors only**; warnings are allowed. Formatting counts as
an error — run `npm run lint:fix` before pushing.

## Product invariants

Break these and the product stops being what it claims to be.

- **Determinism.** Same input → identical futures, scores, and ranking. The
  Monte Carlo is hash-seeded (`mulberry32`) and salted per `simulationId`. No
  unseeded `Math.random()` in the engine path — UUID fallbacks and decorative UI
  animation only.
- **Ranking is engine-owned.** `SimulationEngine` collapse order is what the user
  sees, what gets persisted, and what `DecisionRanked` publishes. The evaluation
  agent *annotates* with expected value via `preserveOrder: true` — it must not
  re-rank, or the learning memory records a different "best" than the UI shows.
- **Honest claims.** The public simulator and Forge/Oracle/Atlas scenarios do
  **not** call an LLM. AI is prose-only enrichment after a deterministic collapse,
  and fails open. Do not write docs or copy implying otherwise.
- **Hard constraints must not disqualify the paths that satisfy them.** Policy
  classifiers read `policyText` (name + thesis + highlights) — never `risks`,
  where "Slow enterprise sales" would misread as an enterprise path. Covered by
  `SimulationEngine.invariants.test.ts`.
- **Missing Supabase env must not crash the SPA.** Guard cloud writes with
  `isSupabaseConfigured`.

## Supabase

**Migration parity is the rule, both directions.** Two separate incidents cost a
repair PR each:

1. Anything applied to the hosted project needs a committed migration file
   using **the same version the server recorded** (check
   `supabase_migrations.schema_migrations`). Hosted-only objects are invisible
   drift.
2. Some merged migrations are deliberately **not** applied to production (they
   say so in their PR). Repo-ahead-of-production is also drift — check before
   assuming a function exists live.

Other traps:

- `revoke ... from public` does **not** remove direct grants. The hosted project
  grants EXECUTE on new functions directly to `anon`/`authenticated`, so revokes
  must name those roles explicitly. CI can't catch this — a fresh local stack has
  no such default privileges.
- RLS helper predicates live in the `private` schema so PostgREST can't publish
  them at `/rest/v1/rpc/`. `authenticated` needs `USAGE` on that schema or every
  workspace policy fails closed.
- Migrations are idempotent by convention (`if not exists`, `drop policy if
  exists`), so a replay is always safe.

## Gotchas

- **CSP is build-only.** `vite.config.ts` injects the `<meta>` policy under
  `apply: "build"` — the dev server needs inline scripts for HMR. If you add a
  new external origin (font, API, image host), update `PRODUCTION_CSP` or it
  silently breaks in production but works locally. Verify with `npm run build &&
  npx vite preview` and check the console for violations.
- **Vendor chunks.** `manualChunks` splits `vendor-react` and `vendor-supabase`
  so app deploys don't bust their cache. Don't inline them back (an earlier
  single-file plugin defeated all 30+ lazy routes).
- **Sticky headers.** `scroll-padding-top: 5rem` on `html` keeps scrolled-to
  elements clear of both sticky headers. Without it, clicks and keyboard focus
  land under the header — this was the root cause of a long-standing flaky E2E.
- **Secrets.** `VITE_*` is compiled into the browser bundle and is public by
  definition — `.env.production` holds only the anon key and Sentry DSN. Server
  keys belong in Supabase Edge Function env (`supabase/functions/`), never with a
  `VITE_` prefix.

## Conventions

- TDD for behavior changes: write the failing test, confirm it fails for the
  right reason, then fix. Bug fixes get a regression test that fails before.
- Tests assert decision *outcomes*, not implementation shape. Avoid tautological
  assertions — `expect(a + b).toBeGreaterThanOrEqual(0)` once hid a real bug.
- Comments explain **why**, not what. Match surrounding density.
- Keep `ARCHITECTURE.md`'s "Known deviations" list shrinking, not growing.
