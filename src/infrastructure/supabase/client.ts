// Supabase client bootstrap only. Feature-specific behavior belongs in
// infrastructure/repositories, infrastructure/auth, infrastructure/storage,
// or infrastructure/queries.

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
/** Prefer publishable key (sb_publishable_...); legacy anon JWT still accepted. */
const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    "[chronos] Missing Supabase credentials. Request Access submissions will not be persisted. " +
      "See .env.example for required variables."
  );
}

/**
 * Auth for the BrowserRouter SPA:
 * - persistSession / autoRefreshToken keep dashboard sessions across reloads.
 * - detectSessionInUrl recovers the magic-link session from the redirect URL.
 * - implicit flow puts tokens in the hash fragment. With path-based routing the
 *   path (`/auth/callback`) is preserved when the client clears the hash.
 *   PKCE is avoided for email magic links: it requires a same-browser code
 *   verifier, so opening the link from mail apps / other devices always fails.
 */
export const supabase = createClient(
  supabaseUrl ?? "https://placeholder.supabase.co",
  supabaseAnonKey ?? "placeholder",
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: "implicit",
    },
  }
);
