-- ============================================================
-- Public beta authentication architecture
-- auth.users → profiles → workspaces → workspace_members
--             → decisions → simulations → events
-- ============================================================

-- profiles ----------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  display_name text not null default '',
  avatar_url text,
  preferred_auth_provider text,
  preferences jsonb not null default '{}'::jsonb,
  onboarded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists profiles_email_idx on public.profiles (email);

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function refresh_updated_at();

-- workspace_members -------------------------------------------
create table if not exists public.workspace_members (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'member'
    check (role in ('owner', 'admin', 'member', 'viewer')),
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create index if not exists workspace_members_user_id_idx
  on public.workspace_members (user_id, created_at desc);

-- decisions (product-level decision objects; sims hang under them) --
create table if not exists public.decisions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  created_by uuid references auth.users (id) on delete set null,
  title text not null,
  description text not null default '',
  status text not null default 'active'
    check (status in ('active', 'decided', 'archived')),
  goal_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists decisions_workspace_id_idx
  on public.decisions (workspace_id, created_at desc);

drop trigger if exists decisions_updated_at on public.decisions;
create trigger decisions_updated_at
  before update on public.decisions
  for each row execute function refresh_updated_at();

-- optional link simulation → decision -------------------------
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'simulations'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'simulations' and column_name = 'decision_id'
  ) then
    alter table public.simulations
      add column decision_id uuid references public.decisions (id) on delete set null;
    create index if not exists simulations_decision_id_idx
      on public.simulations (decision_id);
  end if;
end $$;

-- membership helpers ------------------------------------------
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
      select 'owner'
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

-- Backfill owner memberships from existing workspaces ---------
insert into public.workspace_members (workspace_id, user_id, role)
select w.id, w.owner_id, 'owner'
from public.workspaces w
on conflict (workspace_id, user_id) do nothing;

-- Auto-create profile on signup --------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
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

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- RLS ---------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.workspace_members enable row level security;
alter table public.decisions enable row level security;

drop policy if exists "Users read own profile" on public.profiles;
create policy "Users read own profile"
  on public.profiles for select
  to authenticated
  using (id = auth.uid());

drop policy if exists "Users update own profile" on public.profiles;
create policy "Users update own profile"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

drop policy if exists "Users insert own profile" on public.profiles;
create policy "Users insert own profile"
  on public.profiles for insert
  to authenticated
  with check (id = auth.uid());

drop policy if exists "Members read memberships" on public.workspace_members;
create policy "Members read memberships"
  on public.workspace_members for select
  to authenticated
  using (
    user_id = auth.uid()
    or public.is_workspace_member(workspace_id)
  );

drop policy if exists "Owners manage memberships" on public.workspace_members;
create policy "Owners manage memberships"
  on public.workspace_members for all
  to authenticated
  using (
    public.workspace_role(workspace_id) in ('owner', 'admin')
    or user_id = auth.uid()
  )
  with check (
    public.workspace_role(workspace_id) in ('owner', 'admin')
    or (user_id = auth.uid() and role = 'owner')
  );

drop policy if exists "Members manage decisions" on public.decisions;
create policy "Members manage decisions"
  on public.decisions for all
  to authenticated
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

-- Widen workspace access from owner-only to members (additive) --
drop policy if exists "Members read workspaces" on public.workspaces;
create policy "Members read workspaces"
  on public.workspaces for select
  to authenticated
  using (
    owner_id = auth.uid()
    or public.is_workspace_member(id)
  );

-- events table for product analytics (if missing) -------------
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  event text not null,
  properties jsonb not null default '{}'::jsonb,
  user_agent text,
  path text,
  created_at timestamptz not null default now()
);

-- Additive column for authenticated analytics (existing table may lack it)
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'events' and column_name = 'user_id'
  ) then
    alter table public.events
      add column user_id uuid references auth.users (id) on delete set null;
  end if;
end $$;

create index if not exists events_event_created_at_idx
  on public.events (event, created_at desc);

alter table public.events enable row level security;

drop policy if exists "Anon can insert events" on public.events;
create policy "Anon can insert events"
  on public.events for insert
  to anon, authenticated
  with check (true);

drop policy if exists "Users read own events" on public.events;
create policy "Users read own events"
  on public.events for select
  to authenticated
  using (user_id is null or user_id = auth.uid());
