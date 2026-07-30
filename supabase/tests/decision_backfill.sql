-- ============================================================
-- Decisions from lineages — backfill and write path
-- ============================================================
-- 20260730202201_decisions_from_lineages.sql claims that a lineage is a
-- decision, that the backfill is idempotent, and that save_workspace_home
-- now carries decisions without ever unsetting one. This file proves those
-- claims against real rows rather than assuming them.
--
-- Everything runs inside a transaction that is rolled back, so the database
-- is left untouched.
--
--   psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
--     -v ON_ERROR_STOP=1 -f supabase/tests/decision_backfill.sql

\set ON_ERROR_STOP on

begin;

insert into auth.users (id) values
  ('11111111-1111-4111-8111-111111111111');

insert into public.workspaces (id, owner_id, name) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
   '11111111-1111-4111-8111-111111111111',
   'decision backfill fixture');

-- Three lineages, deliberately awkward:
--   L1 — two versions, inserted newest-first so "earliest names it" is a
--        real assertion rather than an accident of insert order.
--   L2 — a single version.
--   L3 — a non-uuid lineage (legacy local data), which must fall back to the
--        simulation's own id rather than failing the uuid cast.
-- Plus one row with an empty title, which must not violate decisions.title's
-- NOT NULL.
insert into public.simulations
  (id, workspace_id, title, status, created_at, version, lineage_id) values
  ('00000000-0000-4000-8000-000000000002',
   'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Retitled on the re-run', 'completed',
   '2026-03-01T00:00:00Z', 2, 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'),
  ('00000000-0000-4000-8000-000000000001',
   'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'How should we launch?', 'completed',
   '2026-01-01T00:00:00Z', 1, 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'),
  ('00000000-0000-4000-8000-000000000003',
   'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'How should we price?', 'completed',
   '2026-04-01T00:00:00Z', 1, 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'),
  ('00000000-0000-4000-8000-000000000004',
   'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '', 'completed',
   '2026-05-01T00:00:00Z', 1, '0x8d21-legacy');

select private.backfill_decisions_from_lineages();

do $$
declare
  n integer;
  t text;
begin
  -- 1. One decision per lineage, and every simulation linked ---------
  select count(*) into n from public.decisions
   where workspace_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  if n <> 3 then
    raise exception 'expected 3 decisions for 3 lineages, got %', n;
  end if;

  select count(*) into n from public.simulations
   where workspace_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
     and decision_id is null;
  if n <> 0 then
    raise exception '% simulation(s) left without a decision', n;
  end if;

  -- 2. Both versions of L1 share one decision, keyed on the lineage ---
  select count(distinct decision_id) into n from public.simulations
   where id in ('00000000-0000-4000-8000-000000000001',
                '00000000-0000-4000-8000-000000000002');
  if n <> 1 then
    raise exception 'a re-run produced % decisions, expected 1', n;
  end if;

  select decision_id::text into t from public.simulations
   where id = '00000000-0000-4000-8000-000000000001';
  if t is distinct from 'dddddddd-dddd-4ddd-8ddd-dddddddddddd' then
    raise exception 'decision id is not the lineage id: %', t;
  end if;

  -- 3. The earliest version names the decision -----------------------
  select title into t from public.decisions
   where id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
  if t is distinct from 'How should we launch?' then
    raise exception 'decision took its title from the wrong version: %', t;
  end if;

  -- 4. A non-uuid lineage falls back to the simulation id -------------
  select decision_id::text into t from public.simulations
   where id = '00000000-0000-4000-8000-000000000004';
  if t is distinct from '00000000-0000-4000-8000-000000000004' then
    raise exception 'legacy lineage did not fall back to the simulation id: %', t;
  end if;

  -- ...and an empty objective still satisfies decisions.title NOT NULL.
  select title into t from public.decisions
   where id = '00000000-0000-4000-8000-000000000004';
  if coalesce(t, '') = '' then
    raise exception 'untitled simulation produced an empty decision title';
  end if;
end $$;

-- 5. Idempotent: replaying changes nothing ---------------------------
create temporary table decisions_before as
  select id, title, created_at from public.decisions order by id;
create temporary table links_before as
  select id, decision_id from public.simulations order by id;

select private.backfill_decisions_from_lineages();
select private.backfill_decisions_from_lineages();

do $$
declare
  n integer;
begin
  select count(*) into n from (
    select id, title, created_at from public.decisions
    except
    select id, title, created_at from decisions_before
  ) diff;
  if n <> 0 then
    raise exception 'replaying the backfill changed % decision row(s)', n;
  end if;

  select count(*) into n from public.decisions;
  if n <> (select count(*) from decisions_before) then
    raise exception 'replaying the backfill duplicated decisions';
  end if;

  select count(*) into n from (
    select id, decision_id from public.simulations
    except
    select id, decision_id from links_before
  ) diff;
  if n <> 0 then
    raise exception 'replaying the backfill relinked % simulation(s)', n;
  end if;
end $$;

-- 6. save_workspace_home round trip, as a real user ------------------
-- The RPC is SECURITY INVOKER, so this also proves an ordinary member is
-- allowed to write decisions under their own RLS policies.
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111"}';

select public.save_workspace_home(jsonb_build_object(
  'workspace', jsonb_build_object(
    'id', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'owner_id', '11111111-1111-4111-8111-111111111111',
    'name', 'decision backfill fixture',
    'description', '',
    'created_at', '2026-01-01T00:00:00Z'
  ),
  'decisions', jsonb_build_array(jsonb_build_object(
    'id', 'ffffffff-ffff-4fff-8fff-ffffffffffff',
    'workspace_id', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'title', 'Should we open source the engine?',
    'description', '',
    'goal_id', null,
    'created_at', '2026-06-01T00:00:00Z'
  )),
  'simulations', jsonb_build_array(jsonb_build_object(
    'id', '00000000-0000-4000-8000-000000000005',
    'workspace_id', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'goal_id', null,
    'title', 'Should we open source the engine?',
    'status', 'completed',
    'confidence', 0.7,
    'result', '{}'::jsonb,
    'created_at', '2026-06-01T00:00:00Z',
    'version', 1,
    'lineage_id', 'ffffffff-ffff-4fff-8fff-ffffffffffff',
    'parent_simulation_id', null,
    'decision_id', 'ffffffff-ffff-4fff-8fff-ffffffffffff'
  ))
));

-- A save from a client that has never heard of decisions. It must not undo
-- the link the backfill made — the whole point of the coalesce in the RPC.
select public.save_workspace_home(jsonb_build_object(
  'workspace', jsonb_build_object(
    'id', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'owner_id', '11111111-1111-4111-8111-111111111111',
    'name', 'decision backfill fixture',
    'description', '',
    'created_at', '2026-01-01T00:00:00Z'
  ),
  'simulations', jsonb_build_array(jsonb_build_object(
    'id', '00000000-0000-4000-8000-000000000001',
    'workspace_id', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'goal_id', null,
    'title', 'How should we launch?',
    'status', 'completed',
    'confidence', 0.7,
    'result', '{}'::jsonb,
    'created_at', '2026-01-01T00:00:00Z',
    'version', 1,
    'lineage_id', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    'parent_simulation_id', null,
    'decision_id', null
  ))
));

reset role;

do $$
declare
  t text;
  n integer;
begin
  select decision_id::text into t from public.simulations
   where id = '00000000-0000-4000-8000-000000000005';
  if t is distinct from 'ffffffff-ffff-4fff-8fff-ffffffffffff' then
    raise exception 'save_workspace_home did not persist decision_id: %', coalesce(t, 'null');
  end if;

  select title into t from public.decisions
   where id = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
  if t is distinct from 'Should we open source the engine?' then
    raise exception 'save_workspace_home did not persist the decision: %', coalesce(t, 'null');
  end if;

  -- created_by comes from the session, never the payload.
  select count(*) into n from public.decisions
   where id = 'ffffffff-ffff-4fff-8fff-ffffffffffff'
     and created_by = '11111111-1111-4111-8111-111111111111';
  if n <> 1 then
    raise exception 'decision created_by was not taken from the session';
  end if;

  select decision_id::text into t from public.simulations
   where id = '00000000-0000-4000-8000-000000000001';
  if t is distinct from 'dddddddd-dddd-4ddd-8ddd-dddddddddddd' then
    raise exception
      'a legacy save unset an existing decision link (got %)', coalesce(t, 'null');
  end if;
end $$;

select 'decision_backfill: all checks passed' as result;

rollback;
