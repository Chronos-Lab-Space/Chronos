-- ============================================================
-- Decisions as first-class objects: backfill + write path
-- ============================================================
-- `public.decisions`, its RLS policies, its indexes, and
-- `simulations.decision_id` all shipped in 20260721120000_public_beta_auth.sql
-- and were then never written to. The product documented them as done. This
-- migration makes that true for the rows that already exist, and teaches
-- save_workspace_home to keep it true from here on.
--
-- See SPEC-decision-object.md.
--
-- No schema changes: the table, the FK, the trigger, the indexes, the
-- policies and the grants are all already committed. This is data plus one
-- function body.
--
-- ------------------------------------------------------------
-- A lineage is a decision
-- ------------------------------------------------------------
-- `simulations.lineage_id` already groups v1 -> v2 -> v3, so the mapping is
-- decided by the data rather than by us: one decision per distinct lineage.
--
-- The decision *is* keyed on the lineage id. That is what lets the client
-- (`decisionIdForSimulation` in src/domain/workspace/decision.ts) derive the
-- same id offline without coordinating with the server, and it makes this
-- backfill idempotent by construction rather than by bookkeeping.
--
-- The uuid pattern below is deliberately the same one `isUuid` enforces in
-- TypeScript, version and variant nibbles included. A looser pattern here
-- would accept a lineage the client rejects, and the two would key the same
-- rows differently. Anything that fails it falls back to the simulation's own
-- id — a lineage of one — which is a uuid by column definition.
--
-- Idempotent and safe to re-run, like every migration here.
-- ============================================================

-- The mapping rule, in exactly one place -----------------------
-- Inlining this would mean repeating the pattern at every use site, and a
-- rule that appears three times is a rule that eventually disagrees with
-- itself. `private` rather than `public` for the same reason the RLS helpers
-- live there: PostgREST publishes every function in an exposed schema at
-- /rest/v1/rpc/, and this is machinery, not an endpoint.
create or replace function private.decision_id_for_simulation(
  p_simulation_id uuid,
  p_lineage_id text
)
returns uuid
language sql
immutable
set search_path = ''
as $$
  select case
    when coalesce(p_lineage_id, '') ~*
      '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    then p_lineage_id::uuid
    else p_simulation_id
  end;
$$;

comment on function private.decision_id_for_simulation(uuid, text) is
  'One decision per lineage. Mirrors decisionIdForSimulation in src/domain/workspace/decision.ts — the uuid pattern must stay identical, or client and server key the same rows differently.';

-- The backfill itself ------------------------------------------
-- A function rather than loose statements so it can be re-run and asserted
-- on directly (supabase/tests/decision_backfill.sql). It also stays useful
-- after today: any simulation that reaches the database without a decision —
-- an old cached bundle, a client that predates this — gets adopted rather
-- than orphaned.
--
-- SECURITY INVOKER by default, deliberately: called by an ordinary user it
-- repairs only the rows their RLS policies already let them see.
create or replace function private.backfill_decisions_from_lineages()
returns void
language plpgsql
set search_path = ''
as $$
begin
  with unlinked as (
    select
      s.id, s.workspace_id, s.title, s.goal_id, s.created_at, s.version,
      private.decision_id_for_simulation(s.id, s.lineage_id) as decision_id
    from public.simulations s
    where s.decision_id is null
  ),
  first_version as (
    -- The earliest version names the decision: it asked the question.
    select distinct on (decision_id)
      decision_id, workspace_id, title, goal_id, created_at
    from unlinked
    order by decision_id, version asc nulls last, created_at asc, id asc
  )
  insert into public.decisions (
    id, workspace_id, created_by, title, description, goal_id, created_at, updated_at
  )
  select
    fv.decision_id,
    fv.workspace_id,
    w.owner_id,
    coalesce(nullif(btrim(fv.title), ''), 'Untitled decision'),
    '',
    fv.goal_id,
    fv.created_at,
    fv.created_at
  from first_version fv
  join public.workspaces w on w.id = fv.workspace_id
  -- A decision already covering this lineage wins; nothing is merged on a guess.
  on conflict (id) do nothing;

  -- Only where null: a decision_id already set is somebody's deliberate
  -- grouping, and a backfill is not entitled to overrule it. The EXISTS guard
  -- keeps this from failing the FK if the insert above could not see the
  -- workspace row.
  update public.simulations s
  set decision_id = private.decision_id_for_simulation(s.id, s.lineage_id)
  where s.decision_id is null
    and exists (
      select 1 from public.decisions d
      where d.id = private.decision_id_for_simulation(s.id, s.lineage_id)
    );
end;
$$;

select private.backfill_decisions_from_lineages();

-- Machinery, not an API surface. anon has no USAGE on `private` at all, so
-- this is defence in depth against the project's default privileges, which
-- grant EXECUTE on new functions to the API roles directly.
revoke all on function private.decision_id_for_simulation(uuid, text)
  from public, anon, authenticated;
revoke all on function private.backfill_decisions_from_lineages()
  from public, anon, authenticated;

comment on column public.simulations.decision_id is
  'The decision this run answers. Equal to lineage_id when that is a uuid, else the simulation id. Kept in step with decisionIdForSimulation in src/domain/workspace/decision.ts.';

comment on column public.decisions.status is
  'Unmaintained on purpose. Status is derived from the versions (deriveDecisionStatus), never stored — a written copy would drift from the runs it summarises.';

-- ============================================================
-- save_workspace_home: now carries decisions
-- ============================================================
-- Replaces the body from 20260726180000_atomic_save_workspace_home.sql.
-- Everything else about it is unchanged and load-bearing:
--
--   SECURITY INVOKER, so every statement is still subject to the caller's
--   RLS policies. Making this DEFINER would turn one RPC endpoint into a
--   total bypass of the access model. rls_access_matrix.sql asserts this by
--   calling it as a viewer and requiring failure. Do not.
--
--   Upsert-only, never delete. Rows removed locally are still removed
--   through the dedicated delete paths.
--
-- Two additions:
--   1. A decisions upsert, placed *before* simulations. Unlike
--      parent_simulation_id — self-referencing, and so resolved by AFTER ROW
--      triggers at end of statement — simulations.decision_id points at
--      another table, and that row has to exist already.
--   2. decision_id on the simulations upsert, written through coalesce so a
--      client that has not derived one yet can never unset a link the
--      backfill already made.
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

  -- Decisions ---------------------------------------------------
  -- Before simulations: decision_id is a cross-table FK, so the row has to
  -- be there. created_by comes from the session rather than the payload —
  -- it is an audit field, and the client has no business asserting it.
  insert into public.decisions (
    id, workspace_id, created_by, title, description, goal_id, created_at
  )
  select d.id, d.workspace_id, auth.uid(), coalesce(d.title, ''),
         coalesce(d.description, ''), d.goal_id, d.created_at
  from jsonb_to_recordset(coalesce(payload -> 'decisions', '[]'::jsonb))
    as d(id uuid, workspace_id uuid, title text, description text,
         goal_id uuid, created_at timestamptz)
  on conflict (id) do update set
    title       = excluded.title,
    description = excluded.description,
    goal_id     = excluded.goal_id;

  -- Simulations -------------------------------------------------
  -- parent_simulation_id is self-referencing, but referential integrity
  -- is enforced by AFTER ROW triggers that fire once the whole statement
  -- completes, so parents and children may arrive in any order within a
  -- single INSERT. The client still orders them for determinism.
  insert into public.simulations (
    id, workspace_id, goal_id, title, status, confidence, result,
    created_at, version, lineage_id, parent_simulation_id, decision_id
  )
  select s.id, s.workspace_id, s.goal_id, s.title, s.status, s.confidence,
         coalesce(s.result, '{}'::jsonb), s.created_at,
         coalesce(s.version, 1), coalesce(s.lineage_id, s.id::text),
         s.parent_simulation_id, s.decision_id
  from jsonb_to_recordset(coalesce(payload -> 'simulations', '[]'::jsonb))
    as s(id uuid, workspace_id uuid, goal_id uuid, title text, status text,
         confidence numeric, result jsonb, created_at timestamptz,
         version integer, lineage_id text, parent_simulation_id uuid,
         decision_id uuid)
  on conflict (id) do update set
    goal_id              = excluded.goal_id,
    title                = excluded.title,
    status               = excluded.status,
    confidence           = excluded.confidence,
    result               = excluded.result,
    version              = excluded.version,
    lineage_id           = excluded.lineage_id,
    parent_simulation_id = excluded.parent_simulation_id,
    -- Never unset an existing link: a client that predates decisions sends
    -- null here, and losing the backfill to an ordinary save would be silent.
    decision_id          = coalesce(excluded.decision_id, simulations.decision_id);

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
  'Atomic upsert of a whole workspace snapshot, decisions included. SECURITY INVOKER: every statement is subject to the caller''s RLS policies. Never make this DEFINER.';

-- Named explicitly rather than revoking from PUBLIC alone — this project
-- grants EXECUTE on new functions directly to anon and authenticated via
-- default privileges, and revoking from PUBLIC does not remove that.
-- `create or replace` preserves existing grants, so on the hosted project
-- this is a no-op; it matters on a fresh stack.
revoke all on function public.save_workspace_home(jsonb) from public, anon, authenticated;
grant execute on function public.save_workspace_home(jsonb) to authenticated;
