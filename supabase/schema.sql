-- ============================================================
-- Chronos Lab · Supabase schema
-- Run this in your Supabase project's SQL editor once.
-- Project: chronoslab.space
-- ============================================================

-- Enable required extensions
create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
-- access_requests: email submissions from the Request Access form
-- ------------------------------------------------------------
create table if not exists access_requests (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  identity text not null,
  agent_project text not null,
  chronos_motivation text not null,
  source text,                    -- 'dashboard' | 'landing' | 'docs' | etc.
  user_agent text,
  status text default 'pending'
    check (status in ('pending', 'invited', 'rejected')),
  invited_at timestamptz,
  notes text,
  submitted_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Safe migration path for projects created before qualification fields existed.
alter table access_requests add column if not exists identity text;
alter table access_requests add column if not exists agent_project text;
alter table access_requests add column if not exists chronos_motivation text;

-- Enforce qualification fields for all new inserts while remaining safe for
-- existing rows created before the access form was expanded.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'access_requests_required_context'
  ) then
    alter table access_requests
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
  on access_requests (lower(email));

create index if not exists access_requests_status_idx
  on access_requests (status);

create index if not exists access_requests_submitted_at_idx
  on access_requests (submitted_at desc);

-- Automatically refresh updated_at on row update
create or replace function refresh_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists access_requests_updated_at on access_requests;

create trigger access_requests_updated_at
  before update on access_requests
  for each row execute function refresh_updated_at();

-- ------------------------------------------------------------
-- events: lightweight analytics logging
-- ------------------------------------------------------------
create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  event text not null,
  properties jsonb default '{}'::jsonb,
  user_agent text,
  path text,
  created_at timestamptz default now()
);

create index if not exists events_event_idx
  on events (event);

create index if not exists events_created_at_idx
  on events (created_at desc);

-- ------------------------------------------------------------
-- chronos_records: a generic JSONB store behind repository adapters
-- ------------------------------------------------------------
-- Domain repositories map to a collection:
-- simulations | agents | memories | scenarios
--
-- Runtime functions are never persisted. Store only serializable state,
-- decisions, metadata, and reconstructed scenario definitions.
create table if not exists chronos_records (
  collection text not null
    check (collection in (
      'simulations', 'agents', 'memories', 'scenarios', 'workspaces',
      'knowledge_graphs', 'task_graphs', 'capabilities',
      'task_executions', 'evaluations'
    )),
  id text not null,
  owner_id uuid references auth.users(id) default auth.uid(),
  payload jsonb not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  primary key (collection, id)
);

create index if not exists chronos_records_owner_collection_idx
  on chronos_records (owner_id, collection, updated_at desc);

drop trigger if exists chronos_records_updated_at on chronos_records;

create trigger chronos_records_updated_at
  before update on chronos_records
  for each row execute function refresh_updated_at();

-- ------------------------------------------------------------
-- simulation_cache: shared result cache for trusted API/edge workers
-- ------------------------------------------------------------
-- Cache keys are a hash of prompt + workspace + model version + configuration.
-- Do not grant browser clients direct access: prompts may be sensitive.
create table if not exists simulation_cache (
  cache_key text primary key,
  payload jsonb not null,
  created_at timestamptz default now(),
  expires_at timestamptz
);

create index if not exists simulation_cache_expires_at_idx
  on simulation_cache (expires_at)
  where expires_at is not null;

-- ------------------------------------------------------------
-- RLS (Row-Level Security) policies
-- ------------------------------------------------------------

-- Ensure browser clients can submit public form data.
grant usage on schema public to anon;
grant insert on table public.access_requests to anon;
grant insert on table public.events to anon;

-- access_requests: allow anonymous insert, no read/update/delete from client
drop policy if exists "Allow anonymous inserts" on public.access_requests;
alter table public.access_requests enable row level security;

create policy "Allow anonymous inserts"
  on public.access_requests for insert
  to anon
  with check (true);

-- events: allow anonymous insert, no read from client
drop policy if exists "Allow anonymous event inserts" on public.events;
alter table public.events enable row level security;

create policy "Allow anonymous event inserts"
  on public.events for insert
  to anon
  with check (true);

-- chronos_records: user-owned records. Service-role server processes bypass
-- RLS; browser clients can only access their own authenticated records.
drop policy if exists "Users manage their own Chronos records" on chronos_records;
alter table chronos_records enable row level security;

create policy "Users manage their own Chronos records"
  on chronos_records for all
  to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- simulation_cache intentionally has no anon/authenticated policies. Access it
-- from a service-role API or edge function so cache sharing never exposes
-- one workspace's prompt to another browser client.
alter table simulation_cache enable row level security;

-- ============================================================
-- Done. Verify with:
--   select * from access_requests order by submitted_at desc limit 10;
-- ============================================================
