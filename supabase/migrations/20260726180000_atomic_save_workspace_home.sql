-- ============================================================
-- Atomic workspace save
-- ============================================================
-- SupabaseWorkspaceRepository.save() issues seven-plus independent
-- upserts over PostgREST. Each is its own transaction, so a failure
-- part-way through leaves the cloud copy half-written — some tables
-- updated, some not — and WorkspaceService.persist() catches the throw
-- and falls back to local, so nobody ever finds out.
--
-- PostgREST cannot span a transaction across requests. One function call
-- is one statement is one transaction, so moving the whole save into a
-- function is the only way to make it all-or-nothing.
--
-- It also closes the goal-activation race. Today the client pauses other
-- active goals and then upserts the new one as two separate requests;
-- two tabs interleaving there can leave a workspace with zero or two
-- active goals, while load() assumes exactly one. Here both statements
-- are in the same transaction.
--
-- SECURITY INVOKER — deliberately, and load-bearing.
-- ----------------------------------------------------
-- Every statement below runs as the caller, so all the workspace RLS
-- policies still apply: a viewer's save fails on the first write, a
-- member cannot write into a workspace they do not belong to, and an
-- outsider gets nothing. Making this SECURITY DEFINER would turn one RPC
-- endpoint into a total bypass of the entire access model. Do not.
--
-- rls_access_matrix.sql asserts this directly by calling the function as
-- a viewer and requiring it to fail.
--
-- Semantics are deliberately identical to the code it replaces:
-- upsert-only, never delete. Rows removed locally are still removed
-- through the dedicated deleteKnowledge / deleteNote paths.
--
-- Idempotent and safe to re-run.
-- ============================================================

create or replace function public.save_workspace_home(payload jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_goal_id uuid;
  v_workspace_id uuid;
begin
  if payload is null or payload -> 'workspace' is null then
    raise exception 'save_workspace_home: payload.workspace is required';
  end if;

  -- Workspace ---------------------------------------------------
  insert into public.workspaces (id, owner_id, name, description, created_at)
  select w.id, w.owner_id, w.name, coalesce(w.description, ''), w.created_at
  from jsonb_to_record(payload -> 'workspace')
    as w(id uuid, owner_id uuid, name text, description text, created_at timestamptz)
  on conflict (id) do update set
    name        = excluded.name,
    description = excluded.description
  returning id into v_workspace_id;

  -- Goal --------------------------------------------------------
  -- Pause and upsert in one transaction, so the "exactly one active
  -- goal" invariant load() relies on cannot be torn by a concurrent tab.
  if payload -> 'goal' is not null and jsonb_typeof(payload -> 'goal') = 'object' then
    v_goal_id := (payload -> 'goal' ->> 'id')::uuid;

    update public.goals
       set status = 'paused'
     where workspace_id = v_workspace_id
       and status = 'active'
       and id <> v_goal_id;

    insert into public.goals (id, workspace_id, title, description, status, priority, created_at)
    select g.id, g.workspace_id, g.title, coalesce(g.description, ''),
           g.status, coalesce(g.priority, 0), g.created_at
    from jsonb_to_record(payload -> 'goal')
      as g(id uuid, workspace_id uuid, title text, description text,
           status text, priority integer, created_at timestamptz)
    on conflict (id) do update set
      title       = excluded.title,
      description = excluded.description,
      status      = excluded.status,
      priority    = excluded.priority;
  end if;

  -- Knowledge ---------------------------------------------------
  insert into public.knowledge (id, workspace_id, type, title, content, metadata, created_at)
  select k.id, k.workspace_id, k.type, k.title, coalesce(k.content, ''),
         coalesce(k.metadata, '{}'::jsonb), k.created_at
  from jsonb_to_recordset(coalesce(payload -> 'knowledge', '[]'::jsonb))
    as k(id uuid, workspace_id uuid, type text, title text, content text,
         metadata jsonb, created_at timestamptz)
  on conflict (id) do update set
    type     = excluded.type,
    title    = excluded.title,
    content  = excluded.content,
    metadata = excluded.metadata;

  -- Notes -------------------------------------------------------
  insert into public.notes (id, workspace_id, title, content, created_at)
  select n.id, n.workspace_id, n.title, coalesce(n.content, ''), n.created_at
  from jsonb_to_recordset(coalesce(payload -> 'notes', '[]'::jsonb))
    as n(id uuid, workspace_id uuid, title text, content text, created_at timestamptz)
  on conflict (id) do update set
    title   = excluded.title,
    content = excluded.content;

  -- Simulations -------------------------------------------------
  -- parent_simulation_id is self-referencing, but referential integrity
  -- is enforced by AFTER ROW triggers that fire once the whole statement
  -- completes, so parents and children may arrive in any order within a
  -- single INSERT. The client still orders them for determinism.
  insert into public.simulations (
    id, workspace_id, goal_id, title, status, confidence, result,
    created_at, version, lineage_id, parent_simulation_id
  )
  select s.id, s.workspace_id, s.goal_id, s.title, s.status, s.confidence,
         coalesce(s.result, '{}'::jsonb), s.created_at,
         coalesce(s.version, 1), coalesce(s.lineage_id, s.id::text),
         s.parent_simulation_id
  from jsonb_to_recordset(coalesce(payload -> 'simulations', '[]'::jsonb))
    as s(id uuid, workspace_id uuid, goal_id uuid, title text, status text,
         confidence numeric, result jsonb, created_at timestamptz,
         version integer, lineage_id text, parent_simulation_id uuid)
  on conflict (id) do update set
    goal_id              = excluded.goal_id,
    title                = excluded.title,
    status               = excluded.status,
    confidence           = excluded.confidence,
    result               = excluded.result,
    version              = excluded.version,
    lineage_id           = excluded.lineage_id,
    parent_simulation_id = excluded.parent_simulation_id;

  -- Futures -----------------------------------------------------
  insert into public.futures (id, simulation_id, name, score, risk, confidence, summary)
  select f.id, f.simulation_id, f.name, f.score, f.risk, f.confidence,
         coalesce(f.summary, '')
  from jsonb_to_recordset(coalesce(payload -> 'futures', '[]'::jsonb))
    as f(id uuid, simulation_id uuid, name text, score numeric, risk numeric,
         confidence numeric, summary text)
  on conflict (id) do update set
    name       = excluded.name,
    score      = excluded.score,
    risk       = excluded.risk,
    confidence = excluded.confidence,
    summary    = excluded.summary;

  -- Timeline ----------------------------------------------------
  -- Same self-FK reasoning as simulations.
  insert into public.timeline_nodes (id, simulation_id, parent_id, title, depth, score)
  select t.id, t.simulation_id, t.parent_id, t.title,
         coalesce(t.depth, 0), coalesce(t.score, 0)
  from jsonb_to_recordset(coalesce(payload -> 'timeline_nodes', '[]'::jsonb))
    as t(id uuid, simulation_id uuid, parent_id uuid, title text,
         depth integer, score numeric)
  on conflict (id) do update set
    parent_id = excluded.parent_id,
    title     = excluded.title,
    depth     = excluded.depth,
    score     = excluded.score;
end;
$$;

comment on function public.save_workspace_home(jsonb) is
  'Atomic upsert of a whole workspace snapshot. SECURITY INVOKER: every statement is subject to the caller''s RLS policies. Never make this DEFINER.';

-- Named explicitly rather than revoking from PUBLIC alone — this project
-- grants EXECUTE on new functions directly to anon and authenticated via
-- default privileges, and revoking from PUBLIC does not remove that.
revoke all on function public.save_workspace_home(jsonb) from public, anon, authenticated;
grant execute on function public.save_workspace_home(jsonb) to authenticated;
