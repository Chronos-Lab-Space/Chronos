import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { authService } from "../../infrastructure/auth/SupabaseAuthService";

/**
 * Landing page for Supabase magic-link redirects.
 * Waits for detectSessionInUrl to finish, then sends the user to the dashboard.
 */
export function AuthCallbackPage() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    let timeoutId: number | undefined;

    const { data } = authService.onAuthStateChange((event, session) => {
      if (!isMounted) return;
      if (
        session?.user &&
        (event === "SIGNED_IN" || event === "INITIAL_SESSION" || event === "TOKEN_REFRESHED")
      ) {
        if (timeoutId !== undefined) window.clearTimeout(timeoutId);
        navigate("/workspace", { replace: true });
      }
    });

    async function finishSignIn() {
      // Awaits client initialize, including exchange of hash/query tokens.
      const session = await authService.currentSession();
      if (!isMounted) return;

      if (session?.user) {
        navigate("/workspace", { replace: true });
        return;
      }

      timeoutId = window.setTimeout(async () => {
        if (!isMounted) return;
        const retry = await authService.currentSession();
        if (retry?.user) {
          navigate("/workspace", { replace: true });
          return;
        }
        setError(
          "This sign-in link is invalid, expired, or was already used. Request a new magic link."
        );
      }, 5_000);
    }

    void finishSignIn();

    return () => {
      isMounted = false;
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
      data.subscription.unsubscribe();
    };
  }, [navigate]);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg px-6">
        <div className="w-full max-w-md rounded-2xl border border-line bg-bg-soft p-8 text-center">
          <h1 className="font-serif text-3xl text-ink">Sign-in failed</h1>
          <p className="mt-3 text-sm text-ink-dim">{error}</p>
          <Link
            to="/login"
            className="mt-6 inline-flex rounded-lg bg-ink px-4 py-2 text-sm font-medium text-bg transition hover:bg-chronos"
          >
            Back to sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-6">
      <div className="text-center">
        <div className="mx-auto h-6 w-6 rounded-full border border-chronos border-t-transparent animate-spin" />
        <div className="mt-4 font-mono text-[10px] uppercase tracking-[0.24em] text-ink-faint">
          Completing sign-in
        </div>
      </div>
    </div>
  );
}
