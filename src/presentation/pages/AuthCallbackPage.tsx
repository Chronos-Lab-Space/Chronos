import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { accountBootstrapService } from "../../application/workspace/AccountBootstrapService";
import { authService } from "../../infrastructure/auth/SupabaseAuthService";
import { trackProductEvent } from "../../infrastructure/analytics/productAnalytics";

/**
 * OAuth / magic-link landing.
 * Verify session → bootstrap profile + workspace → Decision Workspace.
 */
export function AuthCallbackPage() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState("Completing sign-in");

  useEffect(() => {
    let isMounted = true;
    let timeoutId: number | undefined;

    async function enterWorkspace() {
      setPhase("Creating your workspace");
      const user = await authService.currentUser();
      if (!user) return false;
      try {
        await accountBootstrapService.ensureAccount(user);
        trackProductEvent("session_start", {
          source: "auth_callback",
          provider: (user.app_metadata as { provider?: string })?.provider,
        });
      } catch (err) {
        console.warn("[chronos] bootstrap after auth failed", err);
      }
      if (!isMounted) return false;
      navigate("/workspace", { replace: true });
      return true;
    }

    const { data } = authService.onAuthStateChange((event, session) => {
      if (!isMounted) return;
      if (
        session?.user &&
        (event === "SIGNED_IN" || event === "INITIAL_SESSION" || event === "TOKEN_REFRESHED")
      ) {
        if (timeoutId !== undefined) window.clearTimeout(timeoutId);
        void enterWorkspace();
      }
    });

    async function finishSignIn() {
      const session = await authService.currentSession();
      if (!isMounted) return;

      if (session?.user) {
        await enterWorkspace();
        return;
      }

      timeoutId = window.setTimeout(async () => {
        if (!isMounted) return;
        const retry = await authService.currentSession();
        if (retry?.user) {
          await enterWorkspace();
          return;
        }
        setError(
          "This sign-in link is invalid, expired, or was already used. Try Google, GitHub, or request a new magic link."
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
            to="/login?intent=start"
            className="mt-6 inline-flex rounded-full bg-ink px-4 py-2 text-sm font-medium text-bg transition hover:bg-chronos"
          >
            Back to get started
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
          {phase}
        </div>
        <p className="mt-3 text-sm text-ink-dim">
          Profile → workspace → membership → dashboard
        </p>
      </div>
    </div>
  );
}
