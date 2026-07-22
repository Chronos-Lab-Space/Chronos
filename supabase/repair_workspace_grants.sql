-- ============================================================
-- ONE-SHOT REPAIR — run in Supabase Dashboard → SQL Editor
-- Project: gkyhqnjgwxlyzptpiiob
--
-- Fixes: 403 / 42501
--   "permission denied for function is_workspace_member"
--   when signed-in users hit workspaces / simulations / etc.
-- ============================================================

-- Membership helper used by remote RLS policies
create or replace function public.is_workspace_member(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_members m
    where m.workspace_id = target_workspace_id
      and m.user_id = auth.uid()
  )
  or exists (
    select 1
    from public.workspaces w
    where w.id = target_workspace_id
      and w.owner_id = auth.uid()
  );
$$;

create or replace function public.is_workspace_owner(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspaces w
    where w.id = target_workspace_id
      and w.owner_id = auth.uid()
  )
  or exists (
    select 1
    from public.workspace_members m
    where m.workspace_id = target_workspace_id
      and m.user_id = auth.uid()
      and m.role = 'owner'
  );
$$;

create or replace function public.is_simulation_owner(target_simulation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.simulations s
    where s.id = target_simulation_id
      and public.is_workspace_member(s.workspace_id)
  );
$$;

create or replace function public.workspace_role(target_workspace_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select m.role
      from public.workspace_members m
      where m.workspace_id = target_workspace_id
        and m.user_id = auth.uid()
      limit 1
    ),
    (
      select 'owner'::text
      from public.workspaces w
      where w.id = target_workspace_id
        and w.owner_id = auth.uid()
      limit 1
    )
  );
$$;

-- Lock down then re-grant execute to authenticated
revoke all on function public.is_workspace_member(uuid) from public;
revoke all on function public.is_workspace_owner(uuid) from public;
revoke all on function public.is_simulation_owner(uuid) from public;
revoke all on function public.workspace_role(uuid) from public;

grant execute on function public.is_workspace_member(uuid) to authenticated;
grant execute on function public.is_workspace_owner(uuid) to authenticated;
grant execute on function public.is_simulation_owner(uuid) to authenticated;
grant execute on function public.workspace_role(uuid) to authenticated;

-- Table privileges for Data API
grant usage on schema public to authenticated;
grant usage on schema public to anon;

grant select, insert, update, delete on public.workspaces to authenticated;
grant select, insert, update, delete on public.goals to authenticated;
grant select, insert, update, delete on public.simulations to authenticated;
grant select, insert, update, delete on public.futures to authenticated;
grant select, insert, update, delete on public.knowledge to authenticated;
grant select, insert, update, delete on public.notes to authenticated;
grant select, insert, update, delete on public.timeline_nodes to authenticated;
grant select, insert, update, delete on public.workspace_members to authenticated;

-- Ensure membership table + RLS
create table if not exists public.workspace_members (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'member',
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

alter table public.workspaces enable row level security;
alter table public.goals enable row level security;
alter table public.simulations enable row level security;
alter table public.futures enable row level security;
alter table public.knowledge enable row level security;
alter table public.notes enable row level security;
alter table public.timeline_nodes enable row level security;
alter table public.workspace_members enable row level security;

-- Keep owner in workspace_members automatically
create or replace function public.ensure_workspace_owner_membership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.workspace_members (workspace_id, user_id, role)
  values (new.id, new.owner_id, 'owner')
  on conflict (workspace_id, user_id) do update
    set role = excluded.role;
  return new;
end;
$$;

drop trigger if exists trg_workspace_owner_membership on public.workspaces;
create trigger trg_workspace_owner_membership
  after insert or update of owner_id on public.workspaces
  for each row execute function public.ensure_workspace_owner_membership();

-- Backfill memberships for existing workspaces
insert into public.workspace_members (workspace_id, user_id, role)
select w.id, w.owner_id, 'owner'
from public.workspaces w
on conflict (workspace_id, user_id) do nothing;

-- Policies (member/owner based, matching remote function names)
drop policy if exists "Owners manage their workspaces" on public.workspaces;
drop policy if exists "Members manage workspaces" on public.workspaces;
create policy "Members manage workspaces"
  on public.workspaces for all to authenticated
  using (public.is_workspace_member(id) or owner_id = auth.uid())
  with check (owner_id = auth.uid() or public.is_workspace_member(id));

drop policy if exists "Owners manage goals" on public.goals;
create policy "Owners manage goals"
  on public.goals for all to authenticated
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

drop policy if exists "Owners manage simulations" on public.simulations;
drop policy if exists "Owners manage workspace simulations" on public.simulations;
create policy "Owners manage simulations"
  on public.simulations for all to authenticated
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

drop policy if exists "Owners manage futures" on public.futures;
create policy "Owners manage futures"
  on public.futures for all to authenticated
  using (public.is_simulation_owner(simulation_id))
  with check (public.is_simulation_owner(simulation_id));

drop policy if exists "Owners manage knowledge" on public.knowledge;
drop policy if exists "Owners manage workspace knowledge" on public.knowledge;
create policy "Owners manage knowledge"
  on public.knowledge for all to authenticated
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

drop policy if exists "Owners manage notes" on public.notes;
drop policy if exists "Owners manage workspace notes" on public.notes;
create policy "Owners manage notes"
  on public.notes for all to authenticated
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

drop policy if exists "Owners manage timeline nodes" on public.timeline_nodes;
create policy "Owners manage timeline nodes"
  on public.timeline_nodes for all to authenticated
  using (public.is_simulation_owner(simulation_id))
  with check (public.is_simulation_owner(simulation_id));

drop policy if exists "Members manage memberships" on public.workspace_members;
create policy "Members manage memberships"
  on public.workspace_members for all to authenticated
  using (
    user_id = auth.uid()
    or public.is_workspace_owner(workspace_id)
  )
  with check (
    public.is_workspace_owner(workspace_id)
    or (user_id = auth.uid() and role = 'owner')
  );

-- Verify
select
  p.proname as function_name,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_can_execute
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('is_workspace_member', 'is_workspace_owner', 'is_simulation_owner', 'workspace_role')
order by 1;
