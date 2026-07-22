-- ============================================================
-- Phase 1 Workspace MVP tables
-- Simple relational model for the signed-in product home.
-- ============================================================

-- Shared trigger helper (also defined in schema.sql bootstrap)
create or replace function public.refresh_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- workspaces --------------------------------------------------
create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists workspaces_owner_id_idx
  on public.workspaces (owner_id, created_at desc);

-- workspace_goals ---------------------------------------------
create table if not exists public.workspace_goals (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  title text not null,
  description text not null default '',
  status text not null default 'active'
    check (status in ('active', 'paused', 'completed', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists workspace_goals_workspace_id_idx
  on public.workspace_goals (workspace_id, status);

create unique index if not exists workspace_goals_one_active_per_workspace
  on public.workspace_goals (workspace_id)
  where status = 'active';

drop trigger if exists workspace_goals_updated_at on public.workspace_goals;
create trigger workspace_goals_updated_at
  before update on public.workspace_goals
  for each row execute function refresh_updated_at();

-- simulations -------------------------------------------------
create table if not exists public.simulations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  goal_id uuid references public.workspace_goals (id) on delete set null,
  status text not null default 'queued'
    check (status in ('queued', 'running', 'completed', 'failed')),
  confidence numeric(5, 4)
    check (confidence is null or (confidence >= 0 and confidence <= 1)),
  title text not null default '',
  best_outcome text,
  futures_count integer not null default 0 check (futures_count >= 0),
  created_at timestamptz not null default now()
);

create index if not exists simulations_workspace_id_idx
  on public.simulations (workspace_id, created_at desc);

create index if not exists simulations_goal_id_idx
  on public.simulations (goal_id);

-- knowledge ---------------------------------------------------
create table if not exists public.knowledge (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  type text not null
    check (type in ('pdf', 'note', 'website', 'research', 'other')),
  title text not null,
  content text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists knowledge_workspace_id_idx
  on public.knowledge (workspace_id, type, created_at desc);

-- notes -------------------------------------------------------
create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  title text not null,
  content text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists notes_workspace_id_idx
  on public.notes (workspace_id, updated_at desc);

drop trigger if exists notes_updated_at on public.notes;
create trigger notes_updated_at
  before update on public.notes
  for each row execute function refresh_updated_at();

-- RLS ---------------------------------------------------------
alter table public.workspaces enable row level security;
alter table public.workspace_goals enable row level security;
alter table public.simulations enable row level security;
alter table public.knowledge enable row level security;
alter table public.notes enable row level security;

-- Owner helpers
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

revoke all on function public.is_workspace_owner(uuid) from public;
grant execute on function public.is_workspace_owner(uuid) to authenticated;

drop policy if exists "Owners manage their workspaces" on public.workspaces;
create policy "Owners manage their workspaces"
  on public.workspaces for all
  to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists "Owners manage workspace goals" on public.workspace_goals;
create policy "Owners manage workspace goals"
  on public.workspace_goals for all
  to authenticated
  using (public.is_workspace_owner(workspace_id))
  with check (public.is_workspace_owner(workspace_id));

drop policy if exists "Owners manage workspace simulations" on public.simulations;
create policy "Owners manage workspace simulations"
  on public.simulations for all
  to authenticated
  using (public.is_workspace_owner(workspace_id))
  with check (public.is_workspace_owner(workspace_id));

drop policy if exists "Owners manage workspace knowledge" on public.knowledge;
create policy "Owners manage workspace knowledge"
  on public.knowledge for all
  to authenticated
  using (public.is_workspace_owner(workspace_id))
  with check (public.is_workspace_owner(workspace_id));

drop policy if exists "Owners manage workspace notes" on public.notes;
create policy "Owners manage workspace notes"
  on public.notes for all
  to authenticated
  using (public.is_workspace_owner(workspace_id))
  with check (public.is_workspace_owner(workspace_id));

grant select, insert, update, delete on public.workspaces to authenticated;
grant select, insert, update, delete on public.workspace_goals to authenticated;
grant select, insert, update, delete on public.simulations to authenticated;
grant select, insert, update, delete on public.knowledge to authenticated;
grant select, insert, update, delete on public.notes to authenticated;
