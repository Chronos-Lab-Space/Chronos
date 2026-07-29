# Security

## Reporting

Found a vulnerability? Email **security@chronoslab.space** with steps to
reproduce. Please do not open a public issue for undisclosed vulnerabilities.

## Hardening summary

- **Row Level Security** on every table, consolidated onto one member-based
  model; policies split per verb; CI replays migrations from scratch and
  asserts RLS invariants (`supabase/tests/`).
- **SECURITY DEFINER** helper functions pin `search_path` and revoke
  `EXECUTE` from `anon`/`authenticated` where not needed.
- **Content-Security-Policy** shipped as a build-time `<meta>` tag
  (GitHub Pages cannot serve headers); `script-src 'self'` backstops the
  markdown-render sinks. The workspace framebusts in `src/main.tsx`.
- **Markdown** rendered via `renderSimpleMarkdown` escapes `&<>"'` and only
  emits `https://` links (regression-tested).
- **URL imports** are restricted to `https://` and reject internal/private
  hosts before any fetch.
- Only public client keys ship in `.env.production` (anon key + Sentry DSN);
  history is scanned for leaked secrets.

## Accepted risk exceptions

Tracked exceptions where a flagged issue does not apply to this deployment.
Re-evaluate each when its precondition changes.

### `react-router` / `react-router-dom` — GHSA-qwww-vcr4-c8h2 (High)

- **Advisory:** RSC Mode CSRF bypass allows action execution before a 400
  response. Affected range `>=7.12.0 <8.3.0`.
- **Status:** Accepted, not applicable. This app is a static SPA that uses
  `<BrowserRouter>` with declarative `<Routes>`/`<Route>` (see
  `src/presentation/App.tsx`). It does **not** use React Router's RSC mode,
  data routers (`createBrowserRouter`/`RouterProvider`), or any server
  component APIs, so the vulnerable code path is unreachable.
- **Why not "fix":** No `react-router` v8 exists yet; the only version that
  clears the advisory is a downgrade to `7.11.0`, which would drop seven
  minor releases of fixes and risk routing regressions to close a
  vulnerability that cannot affect this codebase.
- **Revisit when:** a fixed release in the `>=8.3.0` line ships (upgrade
  then), or the app adopts RSC mode / a data router (fix immediately).

## Owner-managed settings

Configured in the Supabase dashboard, not in this repository:

- **Leaked-password protection** (Auth → Providers → Email) — blocks
  passwords found in HaveIBeenPwned. **Currently disabled in production**
  (`get_advisors`, 2026-07-29). Listing a control here is not the same as
  applying it; enable before the beta takes real signups.
- **Email confirmation** (Auth → Providers → Email) — decide whether public
  beta signups must verify their address.

## Migration parity

Verified 2026-07-29: repo and hosted migration histories are identical — 22
versions, matching hash. `20260726190000_ai_usage` was applied to production
under **its own repo version** rather than a fresh timestamp, so the two
histories stay comparable. `apply_migration` generates its own version and
would have introduced exactly the drift `CLAUDE.md` warns about.

## Supabase advisor findings

From `get_advisors` against the hosted project on 2026-07-29. Recorded so they
stop resurfacing as unexplained warnings.

- **`access_requests` allows unrestricted `anon` INSERT** (`WITH CHECK (true)`).
  **Accepted, by design:** the public-beta request form must accept submissions
  from people who have no account, so the policy cannot be narrowed by owner.
  The residual risk is unbounded writes — an anonymous visitor can submit any
  number of rows. **Revisit when:** the table shows spam, or before the beta is
  publicly announced, whichever comes first. The fix is a rate limit at the
  edge, not a tighter policy.
- **`knowledge_edges` — resolved 2026-07-29.** Hosted-only schema for an
  unbuilt knowledge-graph feature: zero rows, no primary key, no indexes, RLS
  enabled with no policies, and no reference anywhere in this repository. It
  accounted for three advisor findings on its own. Dropped via
  `20260729120000_drop_knowledge_edges.sql`, which preserves the original DDL
  in comments so the table can be recreated verbatim if the feature is built.
