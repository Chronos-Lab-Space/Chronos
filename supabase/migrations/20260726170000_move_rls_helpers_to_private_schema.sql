-- ============================================================
-- Move the RLS helper predicates out of the exposed schema
-- ============================================================
-- Clears the six remaining advisor findings of the form
-- authenticated_security_definer_function_executable:
--
--   is_workspace_member, is_workspace_admin, is_workspace_editor,
--   is_simulation_member, is_simulation_editor, workspace_role
--
-- Those cannot be fixed by revoking EXECUTE. The RLS policies call them
-- as `authenticated`, so `authenticated` must keep EXECUTE — which is
-- exactly what the advisor flags. While they live in `public`, PostgREST
-- publishes each one at /rest/v1/rpc/<name>, so every signed-in user can
-- invoke them directly with arbitrary arguments.
--
-- Nothing leaks today: each helper constrains on auth.uid(), so a caller
-- can only ever learn about their own memberships. But an RPC surface
-- that exists only as a side effect of implementation detail is worth
-- removing, and moving them is the fix Supabase documents for a
-- SECURITY DEFINER function that genuinely needs to stay definer.
--
-- They stay SECURITY DEFINER: they read workspace_members, which is
-- itself RLS-protected, so an invoker function would recurse into the
-- policy that calls it.
--
-- No application code calls these — the repo has no .rpc() call sites at
-- all — so nothing client-side changes.
--
-- Idempotent and safe to re-run.
-- ============================================================

-- ------------------------------------------------------------
-- 1. The private schema
-- ------------------------------------------------------------
-- Not listed in PostgREST's exposed schemas, so nothing in here is
-- reachable over the Data API regardless of grants. `authenticated`
-- still needs USAGE, because policy expressions are evaluated as the
-- querying role.

create schema if not exists private;

revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;

comment on schema private is
  'Not exposed via PostgREST. Holds SECURITY DEFINER helpers that RLS policies call but that must not be callable as RPC endpoints.';

-- ------------------------------------------------------------
-- 2. The helpers, re-created in private
-- ------------------------------------------------------------

create or replace function private.is_workspace_member(target_workspace_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.workspace_members m
    where m.workspace_id = target_workspace_id and m.user_id = (select auth.uid())
  )
  or exists (
    select 1 from public.workspaces w
    where w.id = target_workspace_id and w.owner_id = (select auth.uid())
  );
$$;

create or replace function private.is_workspace_admin(target_workspace_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.workspaces w
    where w.id = target_workspace_id and w.owner_id = (select auth.uid())
  )
  or exists (
    select 1 from public.workspace_members m
    where m.workspace_id = target_workspace_id and m.user_id = (select auth.uid())
      and m.role in ('owner', 'admin')
  );
$$;

create or replace function private.is_workspace_editor(target_workspace_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.workspaces w
    where w.id = target_workspace_id and w.owner_id = (select auth.uid())
  )
  or exists (
    select 1 from public.workspace_members m
    where m.workspace_id = target_workspace_id and m.user_id = (select auth.uid())
      and m.role in ('owner', 'admin', 'member')
  );
$$;

create or replace function private.is_simulation_member(target_simulation_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.simulations s
    where s.id = target_simulation_id
      and private.is_workspace_member(s.workspace_id)
  );
$$;

create or replace function private.is_simulation_editor(target_simulation_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.simulations s
    where s.id = target_simulation_id
      and private.is_workspace_editor(s.workspace_id)
  );
$$;

create or replace function private.workspace_role(target_workspace_id uuid)
returns text language sql stable security definer set search_path = ''
as $$
  select coalesce(
    (select m.role from public.workspace_members m
      where m.workspace_id = target_workspace_id and m.user_id = (select auth.uid()) limit 1),
    (select 'owner'::text from public.workspaces w
      where w.id = target_workspace_id and w.owner_id = (select auth.uid()) limit 1)
  );
$$;

-- Named explicitly rather than revoking from PUBLIC alone: this project's
-- default privileges grant EXECUTE on new functions directly to anon and
-- authenticated, and revoking from PUBLIC does not remove a direct grant.
-- That is the exact trap 20260726150000 was written for.
do $do$
declare
  f text;
begin
  foreach f in array array[
    'is_workspace_member', 'is_workspace_admin', 'is_workspace_editor',
    'is_simulation_member', 'is_simulation_editor'
  ]
  loop
    execute format('revoke all on function private.%I(uuid) from public, anon, authenticated', f);
    execute format('grant execute on function private.%I(uuid) to authenticated', f);
  end loop;
end $do$;

revoke all on function private.workspace_role(uuid) from public, anon, authenticated;
grant execute on function private.workspace_role(uuid) to authenticated;

-- ------------------------------------------------------------
-- 3. Repoint every policy at private.*
-- ------------------------------------------------------------
-- Policies must be recreated before the public functions can be dropped:
-- a policy body is a hard dependency, so DROP FUNCTION would fail while
-- any policy still references it.
--
-- Predicates are unchanged — reads admit any member including viewers,
-- writes require an editor, membership changes require an admin. Only the
-- schema qualifier moves. supabase/tests/rls_access_matrix.sql proves the
-- behaviour is identical after the move.

do $do$
declare
  t text;
begin
  foreach t in array array[
    'goals', 'workspace_goals', 'simulations', 'knowledge', 'notes', 'decisions'
  ]
  loop
    execute format('drop policy if exists %I on public.%I', t || '_select', t);
    execute format('drop policy if exists %I on public.%I', t || '_insert', t);
    execute format('drop policy if exists %I on public.%I', t || '_update', t);
    execute format('drop policy if exists %I on public.%I', t || '_delete', t);

    execute format(
      'create policy %I on public.%I for select to authenticated
         using (private.is_workspace_member(workspace_id))',
      t || '_select', t
    );
    execute format(
      'create policy %I on public.%I for insert to authenticated
         with check (private.is_workspace_editor(workspace_id))',
      t || '_insert', t
    );
    execute format(
      'create policy %I on public.%I for update to authenticated
         using (private.is_workspace_editor(workspace_id))
         with check (private.is_workspace_editor(workspace_id))',
      t || '_update', t
    );
    execute format(
      'create policy %I on public.%I for delete to authenticated
         using (private.is_workspace_editor(workspace_id))',
      t || '_delete', t
    );
  end loop;

  foreach t in array array['futures', 'timeline_nodes']
  loop
    execute format('drop policy if exists %I on public.%I', t || '_select', t);
    execute format('drop policy if exists %I on public.%I', t || '_insert', t);
    execute format('drop policy if exists %I on public.%I', t || '_update', t);
    execute format('drop policy if exists %I on public.%I', t || '_delete', t);

    execute format(
      'create policy %I on public.%I for select to authenticated
         using (private.is_simulation_member(simulation_id))',
      t || '_select', t
    );
    execute format(
      'create policy %I on public.%I for insert to authenticated
         with check (private.is_simulation_editor(simulation_id))',
      t || '_insert', t
    );
    execute format(
      'create policy %I on public.%I for update to authenticated
         using (private.is_simulation_editor(simulation_id))
         with check (private.is_simulation_editor(simulation_id))',
      t || '_update', t
    );
    execute format(
      'create policy %I on public.%I for delete to authenticated
         using (private.is_simulation_editor(simulation_id))',
      t || '_delete', t
    );
  end loop;
end $do$;

-- workspaces: only the SELECT policy consults a helper. The write
-- policies are owner_id comparisons and are left untouched.
drop policy if exists "workspaces_select" on public.workspaces;
create policy "workspaces_select" on public.workspaces
  for select to authenticated
  using (
    owner_id = (select auth.uid())
    or private.is_workspace_member(id)
  );

-- workspace_members
drop policy if exists "workspace_members_select" on public.workspace_members;
create policy "workspace_members_select" on public.workspace_members
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or private.is_workspace_member(workspace_id)
  );

drop policy if exists "workspace_members_insert" on public.workspace_members;
create policy "workspace_members_insert" on public.workspace_members
  for insert to authenticated
  with check (private.is_workspace_admin(workspace_id));

drop policy if exists "workspace_members_update" on public.workspace_members;
create policy "workspace_members_update" on public.workspace_members
  for update to authenticated
  using (private.is_workspace_admin(workspace_id))
  with check (private.is_workspace_admin(workspace_id));

drop policy if exists "workspace_members_delete" on public.workspace_members;
create policy "workspace_members_delete" on public.workspace_members
  for delete to authenticated
  using (
    private.is_workspace_admin(workspace_id)
    or user_id = (select auth.uid())
  );

-- ------------------------------------------------------------
-- 4. Drop the public copies
-- ------------------------------------------------------------
-- Nothing references them now. Leaving them behind would keep the RPC
-- endpoints alive and re-raise the advisor findings this migration
-- exists to clear.

drop function if exists public.is_workspace_member(uuid);
drop function if exists public.is_workspace_admin(uuid);
drop function if exists public.is_workspace_editor(uuid);
drop function if exists public.is_simulation_member(uuid);
drop function if exists public.is_simulation_editor(uuid);
drop function if exists public.workspace_role(uuid);
