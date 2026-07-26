-- ============================================================
-- RLS auto-enable event trigger (promoted to a tracked migration)
--
-- Function + event trigger previously existed only on the hosted
-- project (created directly, outside migration history). This
-- migration makes them reproducible: any CREATE TABLE in public
-- gets row level security enabled automatically, as a safety net
-- against forgetting `alter table ... enable row level security`.
-- Idempotent — safe to re-run on hosted and on fresh replays.
-- ============================================================

create or replace function public.rls_auto_enable()
returns event_trigger
language plpgsql
security definer
set search_path to 'pg_catalog'
as $function$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$function$;

-- Event trigger functions are invoked by the system, never by API roles.
revoke all on function public.rls_auto_enable() from public, anon, authenticated;

-- Recreate the trigger idempotently. Guard against environments where
-- the migration role lacks event-trigger privileges — the function is
-- still tracked, and hosted already has the trigger.
do $$
begin
  if not exists (select 1 from pg_event_trigger where evtname = 'ensure_rls') then
    create event trigger ensure_rls
      on ddl_command_end
      when tag in ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      execute function public.rls_auto_enable();
  end if;
exception
  when insufficient_privilege then
    raise log 'rls_auto_enable migration: skipped event trigger creation (insufficient privilege)';
end $$;
