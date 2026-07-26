-- ============================================================
-- Tighten events read policy
-- Audit (2026-07-26): "Users read own events" allowed any
-- authenticated user to read every anonymous event row
-- (user_id is null branch) — exposing properties, user_agent,
-- and path across the whole anonymous telemetry stream.
-- Authenticated users may now read only their own rows.
-- Anonymous rows stay writable (insert policies unchanged) and
-- readable by service_role for internal analytics.
-- Idempotent — safe to re-run.
-- ============================================================

alter table public.events enable row level security;

drop policy if exists "Users read own events" on public.events;
create policy "Users read own events"
  on public.events for select
  to authenticated
  using (user_id = (select auth.uid()));
