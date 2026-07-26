-- ============================================================
-- Security + performance hardening
-- ============================================================
-- Clears the findings raised by `supabase db advisors` / MCP get_advisors
-- on project gkyhqnjgwxlyzptpiiob, plus one issue the advisors do not
-- surface (stray ALL PRIVILEGES grants, section 2).
--
-- Companion to 20260726120000_consolidate_workspace_rls.sql, which covers
-- the workspace product tables. This file covers everything else:
-- profiles, events, access_requests, chronos_records, simulation_cache.
--
-- Idempotent and safe to re-run.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Pin search_path on refresh_updated_at
-- ------------------------------------------------------------
-- Advisor: function_search_path_mutable. A SECURITY INVOKER trigger
-- function is lower risk than a definer one, but a mutable search_path
-- still lets a caller decide which now() this resolves to.
-- refresh_updated_at_if_column_exists was already pinned in
-- 20260723110000; this is the original that was missed.

create or replace function public.refresh_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ------------------------------------------------------------
-- 2. Revoke stray table privileges
-- ------------------------------------------------------------
-- 20260721140000_tighten_anon_grants revoked anon from the workspace
-- product tables but missed these four. anon currently holds the full
-- ALL PRIVILEGES set (SELECT, INSERT, UPDATE, DELETE, TRUNCATE, TRIGGER,
-- REFERENCES) on access_requests, chronos_records, simulation_cache and
-- workspace_goals.
--
-- No data is exposed today: each of those tables has RLS enabled with no
-- policy granting anon anything, so PostgREST returns empty. But that is
-- one permissive policy away from publishing the access_requests table
-- (submitter emails and free-text answers) to anyone holding the
-- publishable key, which ships in .env.production. TRUNCATE is the
-- sharper edge — it is not subject to RLS at all, and is only unreachable
-- because PostgREST exposes no TRUNCATE verb.
--
-- Revoke everything, then re-grant the minimum each role actually uses.

revoke all on table public.access_requests  from anon, authenticated;
revoke all on table public.chronos_records  from anon, authenticated;
revoke all on table public.simulation_cache from anon, authenticated;
revoke all on table public.events           from anon, authenticated;
revoke all on table public.profiles         from anon, authenticated;

-- access_requests: write-only intake for the Request Access form.
-- Reads stay on the dashboard / service_role.
grant insert on table public.access_requests to anon, authenticated;

-- events: anonymous beacon writes, owner-scoped reads.
grant insert         on table public.events to anon;
grant select, insert on table public.events to authenticated;

-- chronos_records: owner-scoped CRUD from SupabaseRepository.
grant select, insert, update, delete on table public.chronos_records to authenticated;

-- profiles: read + upsert own row from AccountBootstrapService. No delete.
grant select, insert, update on table public.profiles to authenticated;

-- simulation_cache: deliberately no grant to either role. The table holds
-- prompt payloads shared across workspaces and is service_role / edge only,
-- as documented in supabase/schema.sql.

grant usage on schema public to anon, authenticated;

-- ------------------------------------------------------------
-- 3. Revoke EXECUTE on trigger functions
-- ------------------------------------------------------------
-- Advisors: anon_security_definer_function_executable and
-- authenticated_security_definer_function_executable on
-- ensure_workspace_owner_membership().
--
-- Postgres grants EXECUTE to PUBLIC on every new function, and anon /
-- authenticated inherit from PUBLIC, so each of these is reachable at
-- /rest/v1/rpc/<name> without any explicit grant. None of them is meant
-- to be an API endpoint — they exist only to be fired by triggers, which
-- run as the table owner and do not consult these grants.

revoke all on function public.ensure_workspace_owner_membership()      from public;
revoke all on function public.handle_new_user()                        from public;
revoke all on function public.refresh_updated_at()                     from public;
revoke all on function public.refresh_updated_at_if_column_exists()    from public;

-- ------------------------------------------------------------
-- 4. Wrap auth.uid() in a scalar subquery
-- ------------------------------------------------------------
-- Advisor: auth_rls_initplan. A bare auth.uid() is re-evaluated per row;
-- (select auth.uid()) is hoisted into an InitPlan and evaluated once.
-- Recreated rather than patched so the file is self-contained.

drop policy if exists "Users read own profile"   on public.profiles;
create policy "Users read own profile" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()));

drop policy if exists "Users update own profile" on public.profiles;
create policy "Users update own profile" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

drop policy if exists "Users insert own profile" on public.profiles;
create policy "Users insert own profile" on public.profiles
  for insert to authenticated
  with check (id = (select auth.uid()));

drop policy if exists "Authenticated can insert access requests" on public.access_requests;
create policy "Authenticated can insert access requests" on public.access_requests
  for insert to authenticated
  with check ((select auth.uid()) is not null);

-- ------------------------------------------------------------
-- 5. Collapse the duplicate events INSERT policies
-- ------------------------------------------------------------
-- Advisor: multiple_permissive_policies on events / authenticated /
-- INSERT. "Anon can insert events" targeted {anon, authenticated} with
-- WITH CHECK (true), which made the stricter own-user_id policy beside it
-- dead weight -- permissive policies OR together, so the unconditional
-- one always won and an authenticated caller could attribute an event to
-- any user_id they liked.
--
-- One policy per role now, and the anonymous path may no longer set
-- user_id at all. SupabaseAnalyticsQueries never sends user_id (all 1077
-- existing rows have it null), so both paths keep working.

drop policy if exists "Anon can insert events"                     on public.events;
drop policy if exists "Authenticated can insert events (own user_id)" on public.events;

create policy "events_insert_anon" on public.events
  for insert to anon
  with check (user_id is null);

create policy "events_insert_authenticated" on public.events
  for insert to authenticated
  with check (
    user_id is null
    or user_id = (select auth.uid())
  );

drop policy if exists "Users read own events" on public.events;
create policy "events_select_own" on public.events
  for select to authenticated
  using (user_id = (select auth.uid()));

-- ------------------------------------------------------------
-- 6. Bound the anonymous write surface on events
-- ------------------------------------------------------------
-- events is insertable by anyone holding the publishable key, with a free
-- text event name and a free JSONB body, and no rate limit. This does not
-- close that off -- a beacon has to stay open to be a beacon -- but it
-- caps what a single row can cost.
--
-- Bounds are ~4x current maximums (longest event name 28 chars, largest
-- properties payload 588 bytes across 1077 rows), so every existing row
-- passes and the constraint is added already validated.
--
-- octet_length(jsonb::text) rather than pg_column_size(): pg_column_size
-- is only STABLE, while jsonb_out and octet_length are both IMMUTABLE,
-- which is what a CHECK constraint wants.

alter table public.events drop constraint if exists events_payload_bounds;
alter table public.events
  add constraint events_payload_bounds
  check (
    length(event) between 1 and 128
    and octet_length(properties::text) <= 8192
    and (user_agent is null or length(user_agent) <= 512)
    and (path is null or length(path) <= 2048)
  );

-- ------------------------------------------------------------
-- 7. Index the unindexed foreign keys
-- ------------------------------------------------------------
-- Advisor: unindexed_foreign_keys. Without a covering index every ON
-- DELETE / ON UPDATE on the referenced side sequentially scans the child.
-- Built non-concurrently: these tables are small (largest is events at
-- 1077 rows) and migrations run in a transaction.

create index if not exists decisions_created_by_idx
  on public.decisions (created_by);

create index if not exists events_user_id_idx
  on public.events (user_id);

create index if not exists notes_workspace_id_idx
  on public.notes (workspace_id);

create index if not exists simulations_parent_simulation_id_idx
  on public.simulations (parent_simulation_id);

create index if not exists timeline_nodes_parent_id_idx
  on public.timeline_nodes (parent_id);

-- ------------------------------------------------------------
-- Not fixed here (dashboard-only settings)
-- ------------------------------------------------------------
-- Advisor: auth_leaked_password_protection. Enable HaveIBeenPwned checking
-- at Authentication -> Policies:
--   https://supabase.com/dashboard/project/gkyhqnjgwxlyzptpiiob/auth/policies
-- The matching local-dev setting is minimum_password_length in
-- supabase/config.toml, raised from 6 to 8 alongside this migration.
-- Neither is expressible as SQL.
