import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { accountBootstrapService } from "../../composition/workspaceService";
import { authService } from "../../infrastructure/auth/SupabaseAuthService";
import { trackProductEvent } from "../../infrastructure/analytics/productAnalytics";
import { WorkspaceLoadingScreen } from "../features/workspace/WorkspaceLoadingScreen";

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
    // finishSignIn and the auth-state listener can both see the same valid
    // session; without this guard both bootstrap, both emit session_start,
    // and both navigate.
    let hasEntered = false;

    async function enterWorkspace() {
      if (hasEntered) return false;
      const user = await authService.currentUser();
      if (!user || hasEntered) return false;
      hasEntered = true;
      setPhase("Creating your workspace");
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

  // Brand loading only on sign-in → workspace entry
  return <WorkspaceLoadingScreen message={phase} />;
}
