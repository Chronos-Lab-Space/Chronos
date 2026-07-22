/**
 * E2E-only mock auth.
 *
 * Enabled only when BOTH:
 *  1. Build flag VITE_E2E_AUTH=true (set by Playwright webServer — never production)
 *  2. localStorage key chronos.e2e.auth=1 (set by the test via addInitScript)
 *
 * Production builds omit the flag, so the localStorage key alone cannot unlock workspace.
 */

import type { Session, User } from "@supabase/supabase-js";

export const E2E_AUTH_STORAGE_KEY = "chronos.e2e.auth";
export const E2E_OWNER_ID = "e2e-user-00000000-0000-4000-8000-000000000001";

export function isE2EAuthEnabled(): boolean {
  try {
    if (import.meta.env.VITE_E2E_AUTH !== "true") return false;
    if (typeof localStorage === "undefined") return false;
    return localStorage.getItem(E2E_AUTH_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function buildE2EUser(): User {
  const now = new Date().toISOString();
  return {
    id: E2E_OWNER_ID,
    app_metadata: { provider: "e2e" },
    user_metadata: { e2e: true },
    aud: "authenticated",
    created_at: now,
    email: "e2e@chronos.local",
    role: "authenticated",
    updated_at: now,
  } as User;
}

export function buildE2ESession(): Session {
  return {
    access_token: "e2e-access-token",
    refresh_token: "e2e-refresh-token",
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    token_type: "bearer",
    user: buildE2EUser(),
  } as Session;
}
