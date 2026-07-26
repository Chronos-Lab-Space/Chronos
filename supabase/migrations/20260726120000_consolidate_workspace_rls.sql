-- ============================================================
-- Consolidate workspace RLS onto a single member-based model
-- ============================================================
-- Background
-- ----------
-- Four successive repair passes (20260721140000_tighten_anon_grants,
-- 20260722090000_workspace_api_grants_repair,
-- 20260722100447_decision_loop_cloud_repair, and the standalone
-- supabase/repair_workspace_grants.sql) each re-granted the same
-- privileges and redefined the same helper functions. They drifted:
--
--   * repair_workspace_grants.sql defines product-table policies with
--     is_workspace_member(); the migrations define them with
--     is_workspace_owner(). Whichever ran last won.
--   * workspaces and workspace_members accumulated three overlapping
--     permissive policies each for the same role + action, because every
--     pass added a policy under a new name instead of replacing the old.
--
-- This migration is the single authority. It drops every legacy policy by
-- name, then creates exactly one policy per table per command.
--
-- Model: MEMBER-BASED, with roles that actually differ. The role check
-- constraint on workspace_members allows owner / admin / member / viewer.
--
--   capability            | owner | admin | member | viewer
--   ----------------------+-------+-------+--------+-------
--   read workspace rows   |  yes  |  yes  |  yes   |  yes
--   write workspace rows  |  yes  |  yes  |  yes   |  NO
--   manage membership     |  yes  |  yes  |  no    |  no
--   rename/delete the ws  |  yes  |  no   |  no    |  no
--
-- Enforced by three predicates: is_workspace_member (read),
-- is_workspace_editor (write, excludes viewer), is_workspace_admin
-- (membership). Workspace rename/delete is owner_id only.
--
-- At the time of writing all membership rows are owners (15 rows, 15
-- workspaces, 0 non-owner members), so this grants no one new access
-- today; it makes sharing possible without another repair pass.
--
-- Idempotent and safe to re-run.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Helper functions
-- ------------------------------------------------------------
-- All are SECURITY DEFINER because they read workspace_members, which is
-- itself RLS-protected; a SECURITY INVOKER helper would recurse into the
-- policy that calls it. Each pins search_path to '' and fully qualifies
-- every reference, so no caller-controlled search_path can redirect them.
-- Every one of them constrains on auth.uid() internally, so they leak
-- nothing about workspaces the caller is not part of.

create or replace function public.is_workspace_member(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.workspace_members m
    where m.workspace_id = target_workspace_id
      and m.user_id = (select auth.uid())
  )
  or exists (
    select 1
    from public.workspaces w
    where w.id = target_workspace_id
      and w.owner_id = (select auth.uid())
  );
$$;

comment on function public.is_workspace_member(uuid) is
  'True when the caller owns the workspace or holds any membership role in it.';

-- Owner/admin rights. Replaces is_workspace_owner(), whose name implied
-- owner-only while callers increasingly needed "may administer".
create or replace function public.is_workspace_admin(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.workspaces w
    where w.id = target_workspace_id
      and w.owner_id = (select auth.uid())
  )
  or exists (
    select 1
    from public.workspace_members m
    where m.workspace_id = target_workspace_id
      and m.user_id = (select auth.uid())
      and m.role in ('owner', 'admin')
  );
$$;

comment on function public.is_workspace_admin(uuid) is
  'True when the caller owns the workspace or holds the owner/admin role in it.';

-- Replaces is_simulation_owner(). The semantics flip from owner to member
-- here, so the name changes with them rather than quietly lying.
create or replace function public.is_simulation_member(target_simulation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.simulations s
    where s.id = target_simulation_id
      and public.is_workspace_member(s.workspace_id)
  );
$$;

comment on function public.is_simulation_member(uuid) is
  'True when the caller is a member of the workspace owning the simulation.';

-- Write rights. The role check constraint on workspace_members allows
-- owner / admin / member / viewer; this is the predicate that makes
-- viewer mean anything, by admitting the first three and excluding it.
create or replace function public.is_workspace_editor(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.workspaces w
    where w.id = target_workspace_id
      and w.owner_id = (select auth.uid())
  )
  or exists (
    select 1
    from public.workspace_members m
    where m.workspace_id = target_workspace_id
      and m.user_id = (select auth.uid())
      and m.role in ('owner', 'admin', 'member')
  );
$$;

comment on function public.is_workspace_editor(uuid) is
  'True when the caller may write to the workspace: owner, admin or member. Viewers are excluded.';

create or replace function public.is_simulation_editor(target_simulation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.simulations s
    where s.id = target_simulation_id
      and public.is_workspace_editor(s.workspace_id)
  );
$$;

comment on function public.is_simulation_editor(uuid) is
  'True when the caller may write to the workspace owning the simulation. Viewers are excluded.';

create or replace function public.workspace_role(target_workspace_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select m.role
      from public.workspace_members m
      where m.workspace_id = target_workspace_id
        and m.user_id = (select auth.uid())
      limit 1
    ),
    (
      select 'owner'::text
      from public.workspaces w
      where w.id = target_workspace_id
        and w.owner_id = (select auth.uid())
      limit 1
    )
  );
$$;

comment on function public.workspace_role(uuid) is
  'The caller''s role in the workspace, or null when they have none.';

-- Execute rights: authenticated only. Postgres grants EXECUTE to PUBLIC on
-- every new function, which would expose these at /rest/v1/rpc/*.
revoke all on function public.is_workspace_member(uuid) from public;
revoke all on function public.is_workspace_admin(uuid) from public;
revoke all on function public.is_workspace_editor(uuid) from public;
revoke all on function public.is_simulation_member(uuid) from public;
revoke all on function public.is_simulation_editor(uuid) from public;
revoke all on function public.workspace_role(uuid) from public;

grant execute on function public.is_workspace_member(uuid) to authenticated;
grant execute on function public.is_workspace_admin(uuid) to authenticated;
grant execute on function public.is_workspace_editor(uuid) to authenticated;
grant execute on function public.is_simulation_member(uuid) to authenticated;
grant execute on function public.is_simulation_editor(uuid) to authenticated;
grant execute on function public.workspace_role(uuid) to authenticated;

-- ------------------------------------------------------------
-- 2. Drop every legacy policy by name
-- ------------------------------------------------------------
-- Names accumulated across all four repair passes. Dropping unconditionally
-- (rather than replacing) is what stops the overlap from regrowing.

drop policy if exists "Members manage workspaces"          on public.workspaces;
drop policy if exists "Members read workspaces"            on public.workspaces;
drop policy if exists "Owners manage their workspaces"     on public.workspaces;

drop policy if exists "Members manage memberships"         on public.workspace_members;
drop policy if exists "Members read memberships"           on public.workspace_members;
drop policy if exists "Owners manage memberships"          on public.workspace_members;

drop policy if exists "Owners manage goals"                on public.goals;
drop policy if exists "Owners manage workspace goals"      on public.workspace_goals;
drop policy if exists "Owners manage simulations"          on public.simulations;
drop policy if exists "Owners manage workspace simulations" on public.simulations;
drop policy if exists "Owners manage futures"              on public.futures;
drop policy if exists "Owners manage knowledge"            on public.knowledge;
drop policy if exists "Owners manage workspace knowledge"  on public.knowledge;
drop policy if exists "Owners manage notes"                on public.notes;
drop policy if exists "Owners manage workspace notes"      on public.notes;
drop policy if exists "Owners manage timeline nodes"       on public.timeline_nodes;
drop policy if exists "Members manage decisions"           on public.decisions;

-- ------------------------------------------------------------
-- 3. RLS on, one policy per table per command
-- ------------------------------------------------------------

alter table public.workspaces        enable row level security;
alter table public.workspace_members enable row level security;
alter table public.goals             enable row level security;
alter table public.workspace_goals   enable row level security;
alter table public.simulations       enable row level security;
alter table public.futures           enable row level security;
alter table public.knowledge         enable row level security;
alter table public.notes             enable row level security;
alter table public.timeline_nodes    enable row level security;
alter table public.decisions         enable row level security;

-- workspaces --------------------------------------------------
-- Split per command: a FOR ALL policy cannot express "members may read,
-- only the owner may hand the row over", and a WITH CHECK permitting
-- is_workspace_member(id) would let a member rewrite owner_id to a third
-- party (the new row still passes the membership test).

create policy "workspaces_select" on public.workspaces
  for select to authenticated
  using (
    owner_id = (select auth.uid())
    or public.is_workspace_member(id)
  );

create policy "workspaces_insert" on public.workspaces
  for insert to authenticated
  with check (owner_id = (select auth.uid()));

-- Owner-only, and owner_id must still be the caller afterwards, so the row
-- cannot be reassigned out from under them.
create policy "workspaces_update" on public.workspaces
  for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy "workspaces_delete" on public.workspaces
  for delete to authenticated
  using (owner_id = (select auth.uid()));

-- workspace_members -------------------------------------------
-- The owner's own membership row is written by the SECURITY DEFINER
-- trigger ensure_workspace_owner_membership(), which bypasses RLS; the
-- insert policy below covers the client-side upsert in
-- AccountBootstrapService, where the caller owns the workspace and is
-- therefore already an admin by is_workspace_admin().

create policy "workspace_members_select" on public.workspace_members
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or public.is_workspace_member(workspace_id)
  );

create policy "workspace_members_insert" on public.workspace_members
  for insert to authenticated
  with check (public.is_workspace_admin(workspace_id));

create policy "workspace_members_update" on public.workspace_members
  for update to authenticated
  using (public.is_workspace_admin(workspace_id))
  with check (public.is_workspace_admin(workspace_id));

-- Admins may remove anyone; anyone may remove themselves (leave).
create policy "workspace_members_delete" on public.workspace_members
  for delete to authenticated
  using (
    public.is_workspace_admin(workspace_id)
    or user_id = (select auth.uid())
  );

-- Workspace-scoped child tables -------------------------------
-- Split per command rather than one FOR ALL policy, because reads and
-- writes no longer share a predicate: reads admit any member (including
-- viewers), writes require an editor. A single FOR ALL policy cannot
-- express that difference.
--
-- workspace_id is not a WITH CHECK escape hatch: moving a row into
-- another workspace requires editor rights on the destination too, since
-- the predicate is evaluated against the new row.
--
-- Generated in a loop so all six tables cannot drift apart by hand-edit.
-- The drops cover both the previous FOR ALL name and the new per-command
-- names, keeping this re-runnable.
do $do$
declare
  t text;
begin
  foreach t in array array[
    'goals', 'workspace_goals', 'simulations', 'knowledge', 'notes', 'decisions'
  ]
  loop
    execute format('drop policy if exists %I on public.%I', t || '_members_all', t);
    execute format('drop policy if exists %I on public.%I', t || '_select', t);
    execute format('drop policy if exists %I on public.%I', t || '_insert', t);
    execute format('drop policy if exists %I on public.%I', t || '_update', t);
    execute format('drop policy if exists %I on public.%I', t || '_delete', t);

    execute format(
      'create policy %I on public.%I for select to authenticated
         using (public.is_workspace_member(workspace_id))',
      t || '_select', t
    );
    execute format(
      'create policy %I on public.%I for insert to authenticated
         with check (public.is_workspace_editor(workspace_id))',
      t || '_insert', t
    );
    execute format(
      'create policy %I on public.%I for update to authenticated
         using (public.is_workspace_editor(workspace_id))
         with check (public.is_workspace_editor(workspace_id))',
      t || '_update', t
    );
    execute format(
      'create policy %I on public.%I for delete to authenticated
         using (public.is_workspace_editor(workspace_id))',
      t || '_delete', t
    );
  end loop;
end $do$;

-- Simulation-scoped child tables ------------------------------
-- Same split, resolved through the simulation's workspace.
do $do$
declare
  t text;
begin
  foreach t in array array['futures', 'timeline_nodes']
  loop
    execute format('drop policy if exists %I on public.%I', t || '_members_all', t);
    execute format('drop policy if exists %I on public.%I', t || '_select', t);
    execute format('drop policy if exists %I on public.%I', t || '_insert', t);
    execute format('drop policy if exists %I on public.%I', t || '_update', t);
    execute format('drop policy if exists %I on public.%I', t || '_delete', t);

    execute format(
      'create policy %I on public.%I for select to authenticated
         using (public.is_simulation_member(simulation_id))',
      t || '_select', t
    );
    execute format(
      'create policy %I on public.%I for insert to authenticated
         with check (public.is_simulation_editor(simulation_id))',
      t || '_insert', t
    );
    execute format(
      'create policy %I on public.%I for update to authenticated
         using (public.is_simulation_editor(simulation_id))
         with check (public.is_simulation_editor(simulation_id))',
      t || '_update', t
    );
    execute format(
      'create policy %I on public.%I for delete to authenticated
         using (public.is_simulation_editor(simulation_id))',
      t || '_delete', t
    );
  end loop;
end $do$;

-- ------------------------------------------------------------
-- 4. Table privileges
-- ------------------------------------------------------------
-- revoke all first, then grant only the four DML privileges. Earlier
-- passes left anon and authenticated holding the full ALL PRIVILEGES set
-- including TRUNCATE, TRIGGER and REFERENCES on several tables. TRUNCATE
-- in particular is NOT subject to RLS.

do $$
declare
  t text;
begin
  foreach t in array array[
    'workspaces', 'workspace_members', 'goals', 'workspace_goals',
    'simulations', 'futures', 'knowledge', 'notes', 'timeline_nodes',
    'decisions'
  ]
  loop
    execute format('revoke all on table public.%I from anon', t);
    execute format('revoke all on table public.%I from authenticated', t);
    execute format(
      'grant select, insert, update, delete on table public.%I to authenticated', t
    );
  end loop;
end $$;

grant usage on schema public to anon, authenticated;

-- ------------------------------------------------------------
-- 5. Retire the superseded helpers
-- ------------------------------------------------------------
-- Safe now that no policy references them. Dropping rather than leaving
-- them in place is deliberate: a stale is_workspace_owner() is exactly
-- what the next repair pass would reach for by mistake.

drop function if exists public.is_workspace_owner(uuid);
drop function if exists public.is_simulation_owner(uuid);
