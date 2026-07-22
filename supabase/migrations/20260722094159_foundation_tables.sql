-- ============================================================
-- Foundation tables used by the SPA (aligned with schema.sql)
-- Idempotent: safe if tables already exist on hosted projects.
-- ============================================================

create extension if not exists "pgcrypto";

create or replace function public.refresh_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- access_requests: Request Access form --------------------------------
create table if not exists public.access_requests (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  identity text not null,
  agent_project text not null,
  chronos_motivation text not null,
  source text,
  user_agent text,
  status text default 'pending'
    check (status in ('pending', 'invited', 'rejected')),
  invited_at timestamptz,
  notes text,
  submitted_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.access_requests add column if not exists identity text;
alter table public.access_requests add column if not exists agent_project text;
alter table public.access_requests add column if not exists chronos_motivation text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'access_requests_required_context'
  ) then
    alter table public.access_requests
      add constraint access_requests_required_context
      check (
        length(trim(coalesce(identity, ''))) > 0
        and length(trim(coalesce(agent_project, ''))) > 0
        and length(trim(coalesce(chronos_motivation, ''))) > 0
      ) not valid;
  end if;
end;
$$;

create unique index if not exists access_requests_email_unique
  on public.access_requests (lower(email));

create index if not exists access_requests_status_idx
  on public.access_requests (status);

create index if not exists access_requests_submitted_at_idx
  on public.access_requests (submitted_at desc);

drop trigger if exists access_requests_updated_at on public.access_requests;
create trigger access_requests_updated_at
  before update on public.access_requests
  for each row execute function public.refresh_updated_at();

-- chronos_records: generic JSONB store --------------------------------
create table if not exists public.chronos_records (
  collection text not null
    check (collection in (
      'simulations', 'agents', 'memories', 'scenarios', 'workspaces',
      'knowledge_graphs', 'task_graphs', 'capabilities',
      'task_executions', 'evaluations'
    )),
  id text not null,
  owner_id uuid references auth.users (id) default auth.uid(),
  payload jsonb not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  primary key (collection, id)
);

create index if not exists chronos_records_owner_collection_idx
  on public.chronos_records (owner_id, collection, updated_at desc);

drop trigger if exists chronos_records_updated_at on public.chronos_records;
create trigger chronos_records_updated_at
  before update on public.chronos_records
  for each row execute function public.refresh_updated_at();

-- simulation_cache: service-role / edge only --------------------------
create table if not exists public.simulation_cache (
  cache_key text primary key,
  payload jsonb not null,
  created_at timestamptz default now(),
  expires_at timestamptz
);

create index if not exists simulation_cache_expires_at_idx
  on public.simulation_cache (expires_at)
  where expires_at is not null;

-- RLS + grants --------------------------------------------------------
grant usage on schema public to anon, authenticated;

alter table public.access_requests enable row level security;
drop policy if exists "Allow anonymous inserts" on public.access_requests;
create policy "Allow anonymous inserts"
  on public.access_requests for insert
  to anon
  with check (true);

grant insert on table public.access_requests to anon;

-- events is created in public_beta_auth; ensure Data API can insert
grant insert on table public.events to anon;
grant select, insert on table public.events to authenticated;

alter table public.chronos_records enable row level security;
drop policy if exists "Users manage their own Chronos records" on public.chronos_records;
create policy "Users manage their own Chronos records"
  on public.chronos_records for all
  to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

grant select, insert, update, delete on table public.chronos_records to authenticated;

-- simulation_cache: no anon/authenticated policies (service_role only)
alter table public.simulation_cache enable row level security;
