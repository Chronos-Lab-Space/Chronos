-- ============================================================
-- Hosted: tighten anon grants on product tables
-- Applied on remote 2026-07-21 (history-only capture for local parity).
-- Idempotent: revoke product-table privileges from anon if any linger.
-- Authenticated retains RLS-scoped CRUD (see later grant repairs).
-- ============================================================

revoke all on table public.workspaces from anon;
revoke all on table public.goals from anon;
revoke all on table public.simulations from anon;
revoke all on table public.futures from anon;
revoke all on table public.knowledge from anon;
revoke all on table public.notes from anon;
revoke all on table public.timeline_nodes from anon;
revoke all on table public.workspace_members from anon;

-- Keep public marketing inserts where intentional (access_requests / events
-- are reaffirmed in later foundation + decision_loop repairs).
