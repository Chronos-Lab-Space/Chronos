-- ============================================================
-- ai_usage — per-call ledger for the `ai-generate` Edge Function
--
-- The Anthropic key is a Supabase secret and the owner pays for every
-- call, so the function must be able to refuse work before it spends
-- money. This table is the counter it reads: one row per upstream
-- attempt, indexed for the two questions asked on the hot path —
-- "how many calls has this user made in the last minute / this month"
-- and "how many has everyone made this month".
--
-- Writes come from the function's admin client (service_role), never
-- through PostgREST. Signed-in users may read their own rows so a usage
-- panel can be built later without another migration.
--
-- See SPEC-ai-proxy.md.
-- ============================================================

create table if not exists public.ai_usage (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  created_at    timestamptz not null default now(),
  model         text not null,
  input_tokens  integer not null default 0 check (input_tokens >= 0),
  output_tokens integer not null default 0 check (output_tokens >= 0),
  -- Anthropic stop_reason, or a local marker (e.g. 'error') when the
  -- upstream call never returned one.
  stop_reason   text,
  ok            boolean not null default true
);

comment on table public.ai_usage is
  'Per-call ledger written by the ai-generate Edge Function. Drives quota enforcement.';

-- Per-user window queries: rate limit (last 60s) and monthly cap.
create index if not exists ai_usage_user_created_idx
  on public.ai_usage (user_id, created_at desc);

-- Global monthly kill switch — no user_id predicate, so it needs its own index.
create index if not exists ai_usage_created_idx
  on public.ai_usage (created_at desc);

alter table public.ai_usage enable row level security;

-- Read-your-own. Wrapped auth.uid() so it is hoisted into an InitPlan
-- rather than re-evaluated per row (rls_invariants check 5).
drop policy if exists ai_usage_select_own on public.ai_usage;
create policy ai_usage_select_own on public.ai_usage
  for select
  to authenticated
  using (user_id = (select auth.uid()));

-- No insert/update/delete policy by design: the only writer is the
-- function's admin client, which bypasses RLS. A write policy here would
-- let any signed-in user forge their own usage rows and erase their cap.
--
-- Explicit revoke first — the hosted project carries default privileges
-- that grant new tables to the API roles, which is what
-- 20260722090000_workspace_api_grants_repair.sql had to clean up before.
revoke all on table public.ai_usage from public, anon, authenticated;
grant select on table public.ai_usage to authenticated;
grant all on table public.ai_usage to service_role;
