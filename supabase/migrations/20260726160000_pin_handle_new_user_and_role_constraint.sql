-- ============================================================
-- Pin handle_new_user's search_path, and guarantee the role constraint
-- ============================================================
-- Two loose ends from the consolidation pass. Both idempotent.
-- ============================================================

-- ------------------------------------------------------------
-- 1. handle_new_user: search_path = 'public' -> ''
-- ------------------------------------------------------------
-- Created by 20260721120000_public_beta_auth with SET search_path =
-- public. That is pinned, so the advisor does not flag it, but it is
-- still weaker than it needs to be: it leaves public first on the path
-- for a SECURITY DEFINER function that runs on every signup, as the
-- definer, triggered by auth.users inserts.
--
-- The body already schema-qualifies public.profiles, and everything else
-- it calls (coalesce, nullif, split_part, now, the ->> operator) lives in
-- pg_catalog, which stays implicitly searchable under an empty path. So
-- '' is a drop-in: the body below is byte-identical to what is deployed
-- apart from the SET clause.
--
-- CREATE OR REPLACE preserves the existing ACL, so the revoke from
-- 20260726150000 is re-asserted at the end rather than relied upon.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, display_name, avatar_url, preferred_auth_provider)
  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      split_part(coalesce(new.email, 'user'), '@', 1)
    ),
    new.raw_user_meta_data ->> 'avatar_url',
    coalesce(new.raw_app_meta_data ->> 'provider', 'email')
  )
  on conflict (id) do update set
    email = excluded.email,
    display_name = coalesce(nullif(public.profiles.display_name, ''), excluded.display_name),
    avatar_url = coalesce(public.profiles.avatar_url, excluded.avatar_url),
    preferred_auth_provider = coalesce(public.profiles.preferred_auth_provider, excluded.preferred_auth_provider),
    updated_at = now();
  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;

-- The trigger is recreated defensively: CREATE OR REPLACE FUNCTION keeps
-- existing triggers bound, but this makes the file safe to run against a
-- project where the trigger was dropped by hand.
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ------------------------------------------------------------
-- 2. workspace_members.role: guarantee the CHECK constraint
-- ------------------------------------------------------------
-- The constraint is created by 20260721120000_public_beta_auth, but two
-- later files (20260722090000_workspace_api_grants_repair and the
-- superseded supabase/repair_workspace_grants.sql) declare the same table
-- with `role text not null default 'member'` and no CHECK. They are
-- no-ops today because CREATE TABLE IF NOT EXISTS finds the table already
-- present — the constraint survives purely because 20260721120000 happens
-- to sort first.
--
-- That is a load-bearing coincidence. Any project bootstrapped from the
-- repair file, or any future reordering, would silently produce an
-- unconstrained role column, and the whole access model keys off these
-- four values: is_workspace_admin matches owner/admin, is_workspace_editor
-- matches owner/admin/member, and anything else degrades to viewer.
-- A typo'd role would fail closed rather than open, but it would also be
-- invisible.
--
-- Dropped and re-added rather than added conditionally, so the definition
-- is asserted rather than merely present. Safe on live data: every
-- existing row is 'owner'.

alter table public.workspace_members
  drop constraint if exists workspace_members_role_check;

alter table public.workspace_members
  add constraint workspace_members_role_check
  check (role in ('owner', 'admin', 'member', 'viewer'));

comment on column public.workspace_members.role is
  'owner | admin | member | viewer. Read by is_workspace_admin (owner/admin), is_workspace_editor (owner/admin/member) and workspace_role.';
