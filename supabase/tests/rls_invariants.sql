-- ============================================================
-- RLS invariants — run against a freshly migrated database
-- ============================================================
-- Guards the failure mode that produced four separate grant-repair
-- passes: policies and grants drifting apart without anyone noticing
-- until signed-in users started getting 401 / 42501 in production.
--
-- Every check below raises an exception on violation, so psql exits
-- non-zero and CI fails. Run with:
--
--   psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
--     -v ON_ERROR_STOP=1 -f supabase/tests/rls_invariants.sql
--
-- Intentionally asserts end state only, never how it was reached, so it
-- stays valid if the migrations are later squashed.
-- ============================================================

\set ON_ERROR_STOP on

-- ------------------------------------------------------------
-- 1. RLS is enabled on every table in the exposed schema
-- ------------------------------------------------------------
do $$
declare
  offenders text;
begin
  select string_agg(c.relname, ', ' order by c.relname)
  into offenders
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind = 'r'
    and not c.relrowsecurity;

  if offenders is not null then
    raise exception 'RLS disabled on public table(s): %', offenders;
  end if;
end $$;

-- ------------------------------------------------------------
-- 2. The retired helpers are gone
-- ------------------------------------------------------------
-- Reintroducing either of these means someone re-ran the superseded
-- repair script and quietly reverted the consolidation.
do $$
begin
  if to_regprocedure('public.is_workspace_owner(uuid)') is not null then
    raise exception
      'is_workspace_owner(uuid) is back — supabase/repair_workspace_grants.sql was probably re-run';
  end if;

  if to_regprocedure('public.is_simulation_owner(uuid)') is not null then
    raise exception
      'is_simulation_owner(uuid) is back — supabase/repair_workspace_grants.sql was probably re-run';
  end if;
end $$;

-- ------------------------------------------------------------
-- 3. Helper functions are definer-safe
-- ------------------------------------------------------------
-- SECURITY DEFINER without a pinned search_path is the classic
-- privilege-escalation shape, and the advisors flag it as
-- function_search_path_mutable.
do $$
declare
  offenders text;
begin
  select string_agg(p.proname, ', ' order by p.proname)
  into offenders
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.prosecdef
    and not exists (
      select 1 from unnest(coalesce(p.proconfig, array[]::text[])) cfg
      where cfg like 'search\_path=%'
    );

  if offenders is not null then
    raise exception
      'SECURITY DEFINER function(s) without a pinned search_path: %', offenders;
  end if;
end $$;

-- Trigger functions must not be reachable as PostgREST RPC endpoints.
do $$
declare
  offenders text;
begin
  select string_agg(p.proname, ', ' order by p.proname)
  into offenders
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.prorettype = 'trigger'::regtype
    and (
      has_function_privilege('anon', p.oid, 'EXECUTE')
      or has_function_privilege('authenticated', p.oid, 'EXECUTE')
    );

  if offenders is not null then
    raise exception
      'Trigger function(s) executable by anon/authenticated: %', offenders;
  end if;
end $$;

-- No SECURITY DEFINER function in the exposed schema may be callable by
-- either API role. Anything in public that anon or authenticated can
-- execute is published by PostgREST at /rest/v1/rpc/<name>, so a definer
-- function there is an API endpoint whether or not anyone meant it to be.
-- The RLS helpers satisfy this by living in `private` instead — see
-- 20260726170000_move_rls_helpers_to_private_schema.
--
-- has_function_privilege rather than reading proacl directly: it resolves
-- grants inherited from PUBLIC *and* direct grants. That distinction is
-- what made this bite on the hosted project but not locally, where the
-- project's default privileges grant EXECUTE on new functions straight to
-- anon and authenticated.
do $$
declare
  offenders text;
begin
  select string_agg(p.proname, ', ' order by p.proname)
  into offenders
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.prosecdef
    and (
      has_function_privilege('anon', p.oid, 'EXECUTE')
      or has_function_privilege('authenticated', p.oid, 'EXECUTE')
    );

  if offenders is not null then
    raise exception
      'SECURITY DEFINER function(s) in public executable by an API role: %', offenders;
  end if;
end $$;

-- The helpers live in private, and anon cannot reach that schema at all.
do $$
declare
  missing text;
begin
  select string_agg(f, ', ' order by f)
  into missing
  from unnest(array[
    'is_workspace_member', 'is_workspace_admin', 'is_workspace_editor',
    'is_simulation_member', 'is_simulation_editor'
  ]) f
  where to_regprocedure(format('private.%I(uuid)', f)) is null;

  if missing is not null then
    raise exception 'RLS helper(s) missing from the private schema: %', missing;
  end if;

  if has_schema_privilege('anon', 'private', 'USAGE') then
    raise exception 'anon holds USAGE on the private schema';
  end if;

  if not has_schema_privilege('authenticated', 'private', 'USAGE') then
    raise exception
      'authenticated lost USAGE on private — every workspace policy will fail closed';
  end if;
end $$;

-- ------------------------------------------------------------
-- 4. One permissive policy per table per role per command
-- ------------------------------------------------------------
-- The drift signature. Each repair pass added a policy under a new name
-- instead of replacing the old one, leaving workspaces and
-- workspace_members with three overlapping policies apiece. Overlapping
-- permissive policies OR together, so the loosest one silently wins.
do $$
declare
  offenders text;
begin
  with expanded as (
    select
      p.tablename,
      r.role,
      c.cmd
    from pg_policies p
    cross join lateral unnest(p.roles) as r(role)
    cross join lateral unnest(
      case p.cmd
        when 'ALL' then array['SELECT', 'INSERT', 'UPDATE', 'DELETE']
        else array[p.cmd]
      end
    ) as c(cmd)
    where p.schemaname = 'public'
      and p.permissive = 'PERMISSIVE'
  )
  select string_agg(
    format('%s (%s/%s): %s policies', tablename, role, cmd, n),
    '; ' order by tablename, role, cmd
  )
  into offenders
  from (
    select tablename, role, cmd, count(*) as n
    from expanded
    group by tablename, role, cmd
    having count(*) > 1
  ) dupes;

  if offenders is not null then
    raise exception 'Overlapping permissive policies — %', offenders;
  end if;
end $$;

-- ------------------------------------------------------------
-- 5. No bare auth.uid() in any policy
-- ------------------------------------------------------------
-- Advisor auth_rls_initplan. A bare auth.uid() is re-evaluated per row;
-- (select auth.uid()) is hoisted into an InitPlan. Counts wrapped vs
-- total occurrences so a policy mixing both forms is still caught.
do $$
declare
  offenders text;
begin
  with exprs as (
    select
      tablename,
      policyname,
      coalesce(qual, '') || ' ' || coalesce(with_check, '') as expr
    from pg_policies
    where schemaname = 'public'
  ),
  counted as (
    select
      tablename,
      policyname,
      (select count(*) from regexp_matches(upper(expr), 'AUTH\.UID\(\)', 'g'))        as total,
      (select count(*) from regexp_matches(upper(expr), 'SELECT AUTH\.UID\(\)', 'g')) as wrapped
    from exprs
  )
  select string_agg(
    format('%s.%s (%s of %s bare)', tablename, policyname, total - wrapped, total),
    '; ' order by tablename, policyname
  )
  into offenders
  from counted
  where total > wrapped;

  if offenders is not null then
    raise exception
      'Policy/policies call auth.uid() unwrapped — use (select auth.uid()): %', offenders;
  end if;
end $$;

-- ------------------------------------------------------------
-- 6. anon holds only the intended privileges
-- ------------------------------------------------------------
-- anon is reachable by anyone holding the publishable key, which ships
-- in .env.production. It may insert into the two public intake tables
-- and nothing else. TRUNCATE matters most here: it is not subject to RLS
-- at all, so a stray grant is not covered by the policies above.
do $$
declare
  offenders text;
begin
  select string_agg(
    format('%s: %s', table_name, privs), '; ' order by table_name
  )
  into offenders
  from (
    select
      table_name,
      string_agg(privilege_type, ',' order by privilege_type) as privs
    from information_schema.role_table_grants
    where table_schema = 'public'
      and grantee = 'anon'
      and not (table_name in ('access_requests', 'events') and privilege_type = 'INSERT')
    group by table_name
  ) g;

  if offenders is not null then
    raise exception
      'anon holds unexpected privileges (only INSERT on access_requests/events is allowed) — %',
      offenders;
  end if;
end $$;

-- simulation_cache is service_role only: it caches prompt payloads
-- shared across workspaces, so neither API role may touch it.
do $$
declare
  offenders text;
begin
  select string_agg(distinct grantee, ', ')
  into offenders
  from information_schema.role_table_grants
  where table_schema = 'public'
    and table_name = 'simulation_cache'
    and grantee in ('anon', 'authenticated');

  if offenders is not null then
    raise exception
      'simulation_cache is service_role only, but is granted to: %', offenders;
  end if;
end $$;

-- ------------------------------------------------------------
-- 7. Every workspace product table is actually reachable
-- ------------------------------------------------------------
-- The inverse failure: RLS policies exist but the GRANT is missing, so
-- PostgREST returns 42501 for signed-in users. This is the exact symptom
-- the four repair migrations were chasing.
do $$
declare
  t text;
  missing text[] := array[]::text[];
begin
  foreach t in array array[
    'workspaces', 'workspace_members', 'goals', 'workspace_goals',
    'simulations', 'futures', 'knowledge', 'notes', 'timeline_nodes',
    'decisions', 'chronos_records'
  ]
  loop
    if not has_table_privilege('authenticated', format('public.%I', t), 'SELECT') then
      missing := missing || t;
    end if;
  end loop;

  if array_length(missing, 1) is not null then
    raise exception
      'authenticated cannot SELECT (missing GRANT, will 42501 via PostgREST): %',
      array_to_string(missing, ', ');
  end if;
end $$;

select 'rls_invariants: all checks passed' as result;
