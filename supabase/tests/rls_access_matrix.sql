-- ============================================================
-- Access matrix — exercises RLS as real users
-- ============================================================
-- rls_invariants.sql inspects the shape of the policies. This file
-- proves what they actually do, by impersonating an owner, a member and
-- a viewer and checking which statements succeed.
--
-- Impersonation matches PostgREST: set the authenticated role and put
-- the user id in request.jwt.claims, which is where auth.uid() reads
-- from. Everything runs inside a transaction that is rolled back, so the
-- database is left untouched.
--
--   psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
--     -v ON_ERROR_STOP=1 -f supabase/tests/rls_access_matrix.sql

\set ON_ERROR_STOP on

begin;

-- auth.users requires only id; is_sso_user and is_anonymous default.
-- Inserting here fires handle_new_user(), which creates public.profiles
-- rows as a side effect. That is intended — it exercises that trigger too.
insert into auth.users (id) values
  ('11111111-1111-4111-8111-111111111111'),  -- owner
  ('22222222-2222-4222-8222-222222222222'),  -- member
  ('33333333-3333-4333-8333-333333333333'),  -- viewer
  ('44444444-4444-4444-8444-444444444444'),  -- outsider, never joins
  ('55555555-5555-4555-8555-555555555555');  -- newcomer, target of membership writes

insert into public.workspaces (id, owner_id, name) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
   '11111111-1111-4111-8111-111111111111',
   'access matrix fixture');

-- The owner's membership row is created by the
-- ensure_workspace_owner_membership() trigger, so only the other two
-- need inserting.
insert into public.workspace_members (workspace_id, user_id, role) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '22222222-2222-4222-8222-222222222222', 'member'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '33333333-3333-4333-8333-333333333333', 'viewer');

insert into public.notes (id, workspace_id, title, content) values
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
   'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
   'seed note', 'visible to every member');

-- ------------------------------------------------------------
-- Helpers
-- ------------------------------------------------------------
create or replace function pg_temp.act_as(user_id uuid)
returns void language plpgsql as $$
begin
  execute format(
    'set local request.jwt.claims = %L',
    json_build_object('sub', user_id, 'role', 'authenticated')::text
  );
  set local role authenticated;
end;
$$;

-- Runs sql as user_id and reports whether it succeeded. Any error means
-- denied — RLS surfaces as either 0 rows affected or a check violation
-- depending on the command, and both count as "cannot".
create or replace function pg_temp.can(user_id uuid, sql text)
returns boolean language plpgsql as $$
declare
  affected int;
begin
  perform pg_temp.act_as(user_id);
  execute sql;
  get diagnostics affected = row_count;
  reset role;
  return affected > 0;
exception when others then
  reset role;
  return false;
end;
$$;

create or replace function pg_temp.expect(
  label text, actual boolean, wanted boolean
) returns void language plpgsql as $$
begin
  if actual is distinct from wanted then
    raise exception 'access matrix: % — expected %, got %',
      label, case when wanted then 'ALLOWED' else 'DENIED' end,
      case when actual then 'ALLOWED' else 'DENIED' end;
  end if;
end;
$$;

-- ------------------------------------------------------------
-- The matrix
-- ------------------------------------------------------------
do $$
declare
  owner_id    uuid := '11111111-1111-4111-8111-111111111111';
  member_id   uuid := '22222222-2222-4222-8222-222222222222';
  viewer_id   uuid := '33333333-3333-4333-8333-333333333333';
  outsider_id uuid := '44444444-4444-4444-8444-444444444444';
  newcomer_id uuid := '55555555-5555-4555-8555-555555555555';
  ws          text := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  save_payload jsonb;
  note        text := 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  read_note   text;
begin
  read_note := format('select 1 from public.notes where id = %L', note);

  -- Reads: everyone in the workspace, including the viewer. Not outsiders.
  perform pg_temp.expect('owner reads notes',    pg_temp.can(owner_id,    read_note), true);
  perform pg_temp.expect('member reads notes',   pg_temp.can(member_id,   read_note), true);
  perform pg_temp.expect('viewer reads notes',   pg_temp.can(viewer_id,   read_note), true);
  perform pg_temp.expect('outsider reads notes', pg_temp.can(outsider_id, read_note), false);

  -- Writes: the whole point of the viewer role.
  perform pg_temp.expect('owner updates note',
    pg_temp.can(owner_id,
      format('update public.notes set title = %L where id = %L', 'by owner', note)), true);
  perform pg_temp.expect('member updates note',
    pg_temp.can(member_id,
      format('update public.notes set title = %L where id = %L', 'by member', note)), true);
  perform pg_temp.expect('VIEWER updates note',
    pg_temp.can(viewer_id,
      format('update public.notes set title = %L where id = %L', 'by viewer', note)), false);

  perform pg_temp.expect('member inserts note',
    pg_temp.can(member_id,
      format('insert into public.notes (workspace_id, title) values (%L, %L)', ws, 'ok')), true);
  perform pg_temp.expect('VIEWER inserts note',
    pg_temp.can(viewer_id,
      format('insert into public.notes (workspace_id, title) values (%L, %L)', ws, 'nope')), false);

  perform pg_temp.expect('VIEWER deletes note',
    pg_temp.can(viewer_id, format('delete from public.notes where id = %L', note)), false);
  perform pg_temp.expect('VIEWER inserts simulation',
    pg_temp.can(viewer_id,
      format('insert into public.simulations (workspace_id, title) values (%L, %L)', ws, 'nope')), false);
  perform pg_temp.expect('VIEWER inserts knowledge',
    pg_temp.can(viewer_id,
      format('insert into public.knowledge (workspace_id, type, title) values (%L, %L, %L)',
             ws, 'note', 'nope')), false);

  -- Membership management: admin rights, so member and viewer are out.
  -- Targets newcomer_id, never outsider_id — the isolation checks below
  -- depend on the outsider still having no membership.
  perform pg_temp.expect('VIEWER adds a member',
    pg_temp.can(viewer_id,
      format('insert into public.workspace_members (workspace_id, user_id, role) values (%L, %L, %L)',
             ws, newcomer_id, 'member')), false);
  perform pg_temp.expect('member adds a member',
    pg_temp.can(member_id,
      format('insert into public.workspace_members (workspace_id, user_id, role) values (%L, %L, %L)',
             ws, newcomer_id, 'member')), false);
  perform pg_temp.expect('owner adds a member',
    pg_temp.can(owner_id,
      format('insert into public.workspace_members (workspace_id, user_id, role) values (%L, %L, %L)',
             ws, newcomer_id, 'viewer')), true);

  -- Workspace rename is owner-only, and ownership cannot be handed off
  -- by a non-owner.
  perform pg_temp.expect('member renames workspace',
    pg_temp.can(member_id,
      format('update public.workspaces set name = %L where id = %L', 'hijacked', ws)), false);
  perform pg_temp.expect('owner renames workspace',
    pg_temp.can(owner_id,
      format('update public.workspaces set name = %L where id = %L', 'renamed', ws)), true);
  perform pg_temp.expect('member steals ownership',
    pg_temp.can(member_id,
      format('update public.workspaces set owner_id = %L where id = %L', member_id, ws)), false);

  -- Cross-workspace isolation: an outsider sees and touches nothing.
  perform pg_temp.expect('outsider reads workspace',
    pg_temp.can(outsider_id, format('select 1 from public.workspaces where id = %L', ws)), false);
  perform pg_temp.expect('outsider inserts note',
    pg_temp.can(outsider_id,
      format('insert into public.notes (workspace_id, title) values (%L, %L)', ws, 'nope')), false);

  -- save_workspace_home must not be a way around any of the above.
  -- It is SECURITY INVOKER, so the same policies apply inside it; if it
  -- were ever switched to DEFINER these three checks are what would fail.
  -- Each payload carries a brand-new note, so a caller who lacks editor
  -- rights is rejected even if the workspace upsert itself were a no-op.
  save_payload := jsonb_build_object(
    'workspace', jsonb_build_object(
      'id', ws, 'owner_id', owner_id, 'name', 'saved via rpc',
      'description', '', 'created_at', now()
    ),
    'notes', jsonb_build_array(jsonb_build_object(
      'id', gen_random_uuid(), 'workspace_id', ws, 'title', 'rpc note',
      'content', '', 'created_at', now()
    ))
  );

  perform pg_temp.expect('owner saves via rpc',
    pg_temp.can(owner_id,
      format('select public.save_workspace_home(%L::jsonb)', save_payload)), true);
  perform pg_temp.expect('VIEWER saves via rpc',
    pg_temp.can(viewer_id,
      format('select public.save_workspace_home(%L::jsonb)', save_payload)), false);
  perform pg_temp.expect('outsider saves via rpc',
    pg_temp.can(outsider_id,
      format('select public.save_workspace_home(%L::jsonb)', save_payload)), false);

  -- Known limitation, asserted so it cannot change unnoticed: a non-owner
  -- member also cannot save, because the snapshot always upserts the
  -- workspace row and workspaces_update is owner-only. This predates the
  -- RPC — the previous client-side save() had the same constraint. If
  -- members are ever meant to save, this expectation flips to true.
  perform pg_temp.expect('member saves via rpc (owner-only workspace row)',
    pg_temp.can(member_id,
      format('select public.save_workspace_home(%L::jsonb)', save_payload)), false);
end $$;

select 'rls_access_matrix: all checks passed' as result;

rollback;
