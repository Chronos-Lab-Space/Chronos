-- ============================================================
-- Revoke function EXECUTE from the API roles explicitly
-- ============================================================
-- Found while applying 20260726120000 / 20260726120500 to the hosted
-- project (2026-07-26). Both files revoke EXECUTE with:
--
--   revoke all on function public.f(...) from public;
--
-- That is enough on a fresh database, where the only EXECUTE grant is the
-- implicit one Postgres gives to PUBLIC. It is NOT enough on this hosted
-- project, which has default privileges configured along the lines of
--
--   alter default privileges in schema public
--     grant execute on functions to anon, authenticated, service_role;
--
-- so every newly created function receives a DIRECT grant to anon and
-- authenticated. Revoking from PUBLIC does not remove a direct grant, so
-- after applying those migrations the hosted project had:
--
--   is_workspace_admin   anon=X  authenticated=X   <- direct, unintended
--   is_workspace_editor  anon=X  authenticated=X
--   is_simulation_member anon=X  authenticated=X
--   is_simulation_editor anon=X  authenticated=X
--
-- (is_workspace_member and workspace_role were unaffected: they already
-- existed with a cleaned ACL, which CREATE OR REPLACE preserves.)
--
-- Exposure was limited — every helper constrains on auth.uid(), which is
-- null for anon, so they returned false rather than leaking anything —
-- but they were reachable at /rest/v1/rpc/<name> and had no business
-- being so.
--
-- This is why the check lives in CI as well: rls_invariants.sql now fails
-- on any SECURITY DEFINER function in public that anon can execute.
--
-- Idempotent and safe to re-run.
-- ============================================================

-- Helper predicates: authenticated only. They must stay executable by
-- authenticated, because the RLS policies call them as that role.
revoke all on function public.is_workspace_member(uuid)   from public, anon, authenticated;
revoke all on function public.is_workspace_admin(uuid)    from public, anon, authenticated;
revoke all on function public.is_workspace_editor(uuid)   from public, anon, authenticated;
revoke all on function public.is_simulation_member(uuid)  from public, anon, authenticated;
revoke all on function public.is_simulation_editor(uuid)  from public, anon, authenticated;
revoke all on function public.workspace_role(uuid)        from public, anon, authenticated;

grant execute on function public.is_workspace_member(uuid)   to authenticated;
grant execute on function public.is_workspace_admin(uuid)    to authenticated;
grant execute on function public.is_workspace_editor(uuid)   to authenticated;
grant execute on function public.is_simulation_member(uuid)  to authenticated;
grant execute on function public.is_simulation_editor(uuid)  to authenticated;
grant execute on function public.workspace_role(uuid)        to authenticated;

-- Trigger functions: no API role at all. Firing a trigger does not check
-- EXECUTE on the trigger function — that privilege is only checked when
-- the trigger is created — so revoking here does not stop the triggers.
-- Confirmed by the access matrix test, which relies on both
-- ensure_workspace_owner_membership() and handle_new_user() firing.
revoke all on function public.ensure_workspace_owner_membership()   from public, anon, authenticated;
revoke all on function public.handle_new_user()                     from public, anon, authenticated;
revoke all on function public.refresh_updated_at()                  from public, anon, authenticated;
revoke all on function public.refresh_updated_at_if_column_exists() from public, anon, authenticated;
