-- ============================================================
-- Revoke function grants from API roles (repo parity file)
--
-- This version exists in the hosted project's migration history
-- (applied 2026-07-26 as a production repair) but the SQL was not
-- committed to the repo, leaving the version ledgers out of sync.
-- This file reconstructs the applied change from the observed
-- hosted grant state so local replays and `supabase db push`
-- agree with production. Idempotent — safe to re-run anywhere.
--
-- End state (verified against hosted 2026-07-26):
-- - Trigger/internal functions: not executable by anon or
--   authenticated (triggers do not need caller EXECUTE).
-- - RLS helper predicates: executable by authenticated only
--   (policies evaluate them as the querying role); never anon.
-- ============================================================

-- Internal/trigger functions: no API role may call them directly.
revoke all on function public.ensure_workspace_owner_membership()   from public, anon, authenticated;
revoke all on function public.handle_new_user()                     from public, anon, authenticated;
revoke all on function public.refresh_updated_at()                  from public, anon, authenticated;
revoke all on function public.refresh_updated_at_if_column_exists() from public, anon, authenticated;

-- rls_auto_enable exists only on the hosted project (created directly,
-- not by any repo migration) — guard so fresh local replays don't fail.
do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    revoke all on function public.rls_auto_enable() from public, anon, authenticated;
  end if;
end $$;

-- RLS helper predicates: authenticated only.
revoke all on function public.is_workspace_member(uuid)  from public, anon;
revoke all on function public.is_workspace_editor(uuid)  from public, anon;
revoke all on function public.is_workspace_admin(uuid)   from public, anon;
revoke all on function public.workspace_role(uuid)       from public, anon;
revoke all on function public.is_simulation_member(uuid) from public, anon;
revoke all on function public.is_simulation_editor(uuid) from public, anon;

grant execute on function public.is_workspace_member(uuid)  to authenticated;
grant execute on function public.is_workspace_editor(uuid)  to authenticated;
grant execute on function public.is_workspace_admin(uuid)   to authenticated;
grant execute on function public.workspace_role(uuid)       to authenticated;
grant execute on function public.is_simulation_member(uuid) to authenticated;
grant execute on function public.is_simulation_editor(uuid) to authenticated;
