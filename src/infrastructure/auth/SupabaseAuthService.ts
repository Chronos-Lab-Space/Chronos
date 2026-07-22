import type { AuthChangeEvent, Session, SupabaseClient, User } from "@supabase/supabase-js";
import { supabase } from "../supabase/client";
import {
  buildE2ESession,
  buildE2EUser,
  isE2EAuthEnabled,
} from "./e2eAuth";

/**
 * Authentication boundary for dashboard users. Presentation code depends on
 * this service rather than directly on Supabase Auth methods.
 *
 * When VITE_E2E_AUTH + localStorage flag are set (Playwright only), returns a
 * stable mock session so the Decision Workspace loop can be tested without
 * real Supabase credentials.
 */
export class SupabaseAuthService {
  constructor(private readonly client: SupabaseClient = supabase) {}

  async currentUser(): Promise<User | null> {
    if (isE2EAuthEnabled()) return buildE2EUser();
    const { data, error } = await this.client.auth.getUser();
    if (error) return null;
    return data.user;
  }

  async currentSession(): Promise<Session | null> {
    if (isE2EAuthEnabled()) return buildE2ESession();
    const { data, error } = await this.client.auth.getSession();
    if (error) return null;
    return data.session;
  }

  async signInWithMagicLink(email: string, redirectTo?: string) {
    return this.client.auth.signInWithOtp({
      email,
      options: redirectTo ? { emailRedirectTo: redirectTo } : undefined,
    });
  }

  async signInWithPassword(email: string, password: string) {
    return this.client.auth.signInWithPassword({ email, password });
  }

  /**
   * Public beta OAuth — Google / GitHub.
   * Redirect URLs must include {origin}/auth/callback in Supabase Auth settings.
   */
  async signInWithOAuth(provider: "google" | "github", redirectTo?: string) {
    const target =
      redirectTo ??
      (typeof window !== "undefined" ? `${window.location.origin}/auth/callback` : undefined);
    return this.client.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: target,
        skipBrowserRedirect: false,
      },
    });
  }

  async signOut() {
    if (isE2EAuthEnabled()) {
      try {
        localStorage.removeItem("chronos.e2e.auth");
      } catch {
        /* ignore */
      }
      return { error: null };
    }
    return this.client.auth.signOut();
  }

  onAuthStateChange(
    listener: (event: AuthChangeEvent, session: Session | null) => void
  ) {
    if (isE2EAuthEnabled()) {
      // Fire once so ProtectedRoute / WorkspaceProvider settle like a real session.
      queueMicrotask(() => listener("SIGNED_IN", buildE2ESession()));
      return {
        data: {
          subscription: {
            unsubscribe: () => undefined,
          },
        },
      };
    }
    return this.client.auth.onAuthStateChange(listener);
  }
}

/** Maps Supabase auth errors into short, user-facing copy. */
export function formatAuthError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes("rate limit") || lower.includes("email rate limit")) {
    return (
      "Email rate limit exceeded. Supabase's free email provider only allows a " +
      "few magic links per hour. Wait about an hour, or sign in with email and password instead."
    );
  }
  if (lower.includes("invalid login credentials")) {
    return "Invalid email or password.";
  }
  if (lower.includes("email not confirmed")) {
    return "Confirm your email before signing in, or use a magic link once the rate limit resets.";
  }
  return message;
}

export const authService = new SupabaseAuthService();
