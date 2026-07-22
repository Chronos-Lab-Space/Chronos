-- ============================================================
-- Repair: expose workspace product tables to authenticated API
-- ============================================================
-- Symptom: PostgREST returns 401 / 42501 "permission denied for table …"
-- even for signed-in users when GRANT privileges are missing.
--
-- After Supabase stopped auto-exposing new tables to the Data API,
-- tables can exist with RLS policies but without role privileges.
-- This migration is idempotent and safe to re-run.
-- ============================================================

-- Ensure product tables exist (no-op if already created by earlier migrations)
create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  description text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.goals (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  title text not null,
  description text not null default '',
  status text not null default 'active'
    check (status in ('active', 'paused', 'completed', 'archived')),
  priority integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.simulations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  goal_id uuid references public.goals (id) on delete set null,
  title text not null default '',
  status text not null default 'queued'
    check (status in ('queued', 'running', 'completed', 'failed')),
  confidence numeric(5, 4)
    check (confidence is null or (confidence >= 0 and confidence <= 1)),
  result jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  version integer not null default 1,
  lineage_id text,
  parent_simulation_id uuid references public.simulations (id) on delete set null
);

create table if not exists public.futures (
  id uuid primary key default gen_random_uuid(),
  simulation_id uuid not null references public.simulations (id) on delete cascade,
  name text not null,
  score numeric(8, 4) not null default 0,
  risk numeric(8, 4) not null default 0,
  confidence numeric(5, 4) not null default 0,
  summary text not null default ''
);

create table if not exists public.knowledge (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  type text not null check (type in ('pdf', 'url', 'note', 'markdown', 'txt', 'github')),
  title text not null,
  content text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  title text not null,
  content text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.timeline_nodes (
  id uuid primary key default gen_random_uuid(),
  simulation_id uuid not null references public.simulations (id) on delete cascade,
  parent_id uuid references public.timeline_nodes (id) on delete cascade,
  title text not null,
  depth integer not null default 0,
  score numeric(8, 4) not null default 0
);

-- Versioning columns (if tables predate versioning migration)
alter table public.simulations
  add column if not exists version integer not null default 1;
alter table public.simulations
  add column if not exists lineage_id text;
alter table public.simulations
  add column if not exists parent_simulation_id uuid references public.simulations (id) on delete set null;

-- Knowledge type constraint (include txt + github)
do $$
begin
  alter table public.knowledge drop constraint if exists knowledge_type_check;
  alter table public.knowledge
    add constraint knowledge_type_check
    check (type in ('pdf', 'url', 'note', 'markdown', 'txt', 'github'));
exception when others then
  null;
end $$;

-- RLS on
alter table public.workspaces enable row level security;
alter table public.goals enable row level security;
alter table public.simulations enable row level security;
alter table public.futures enable row level security;
alter table public.knowledge enable row level security;
alter table public.notes enable row level security;
alter table public.timeline_nodes enable row level security;

-- Ownership helpers
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
    join public.workspaces w on w.id = s.workspace_id
    where s.id = target_simulation_id
      and w.owner_id = auth.uid()
  );
$$;

revoke all on function public.is_workspace_owner(uuid) from public;
revoke all on function public.is_simulation_owner(uuid) from public;
grant execute on function public.is_workspace_owner(uuid) to authenticated;
grant execute on function public.is_simulation_owner(uuid) to authenticated;

-- Policies (owners only)
drop policy if exists "Owners manage their workspaces" on public.workspaces;
create policy "Owners manage their workspaces"
  on public.workspaces for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists "Owners manage goals" on public.goals;
create policy "Owners manage goals"
  on public.goals for all to authenticated
  using (public.is_workspace_owner(workspace_id))
  with check (public.is_workspace_owner(workspace_id));

drop policy if exists "Owners manage simulations" on public.simulations;
drop policy if exists "Owners manage workspace simulations" on public.simulations;
create policy "Owners manage simulations"
  on public.simulations for all to authenticated
  using (public.is_workspace_owner(workspace_id))
  with check (public.is_workspace_owner(workspace_id));

drop policy if exists "Owners manage futures" on public.futures;
create policy "Owners manage futures"
  on public.futures for all to authenticated
  using (public.is_simulation_owner(simulation_id))
  with check (public.is_simulation_owner(simulation_id));

drop policy if exists "Owners manage knowledge" on public.knowledge;
drop policy if exists "Owners manage workspace knowledge" on public.knowledge;
create policy "Owners manage knowledge"
  on public.knowledge for all to authenticated
  using (public.is_workspace_owner(workspace_id))
  with check (public.is_workspace_owner(workspace_id));

drop policy if exists "Owners manage notes" on public.notes;
drop policy if exists "Owners manage workspace notes" on public.notes;
create policy "Owners manage notes"
  on public.notes for all to authenticated
  using (public.is_workspace_owner(workspace_id))
  with check (public.is_workspace_owner(workspace_id));

drop policy if exists "Owners manage timeline nodes" on public.timeline_nodes;
create policy "Owners manage timeline nodes"
  on public.timeline_nodes for all to authenticated
  using (public.is_simulation_owner(simulation_id))
  with check (public.is_simulation_owner(simulation_id));

-- Membership model used by hosted project policies
create table if not exists public.workspace_members (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'member',
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

alter table public.workspace_members enable row level security;

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

revoke all on function public.is_workspace_member(uuid) from public;
revoke all on function public.workspace_role(uuid) from public;
grant execute on function public.is_workspace_member(uuid) to authenticated;
grant execute on function public.workspace_role(uuid) to authenticated;
grant execute on function public.is_workspace_owner(uuid) to authenticated;
grant execute on function public.is_simulation_owner(uuid) to authenticated;

-- Schema + table privileges for Data API (authenticated only)
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

-- Keep owner membership rows in sync
create or replace function public.ensure_workspace_owner_membership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.workspace_members (workspace_id, user_id, role)
  values (new.id, new.owner_id, 'owner')
  on conflict (workspace_id, user_id) do update set role = excluded.role;
  return new;
end;
$$;

drop trigger if exists trg_workspace_owner_membership on public.workspaces;
create trigger trg_workspace_owner_membership
  after insert or update of owner_id on public.workspaces
  for each row execute function public.ensure_workspace_owner_membership();

insert into public.workspace_members (workspace_id, user_id, role)
select w.id, w.owner_id, 'owner'
from public.workspaces w
on conflict (workspace_id, user_id) do nothing;

-- Explicitly do NOT grant workspace product tables to anon.
-- Public marketing only needs access_requests / events (see schema.sql).
