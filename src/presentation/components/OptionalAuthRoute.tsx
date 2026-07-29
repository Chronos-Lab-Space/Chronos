import { useEffect, useState } from "react";
import { authService } from "../../infrastructure/auth/SupabaseAuthService";

/**
 * Renders whether or not anyone is signed in.
 *
 * The workspace is local-first: an anonymous visitor gets a real workspace
 * backed by localStorage, and signing in is how work becomes durable and
 * shareable rather than how it starts.
 *
 * Still waits for Supabase auth to initialise before rendering. Without that
 * wait a returning signed-in user would be handed an anonymous owner id for the
 * moment before session recovery lands, and would briefly see an empty
 * workspace that is not theirs.
 *
 * See SPEC-anonymous-workspace.md.
 */
export function OptionalAuthRoute({ children }: { children: React.ReactNode }) {
  const [authResolved, setAuthResolved] = useState(false);

  useEffect(() => {
    let isMounted = true;

    authService
      .currentSession()
      .catch(() => null)
      .finally(() => {
        if (isMounted) setAuthResolved(true);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  if (!authResolved) {
    return (
      <div className="flex min-h-[45vh] items-center justify-center bg-bg">
        <div className="text-center">
          <div className="mx-auto h-6 w-6 rounded-full border border-chronos border-t-transparent animate-spin" />
          <div className="mt-4 font-mono text-[10px] uppercase tracking-[0.24em] text-ink-faint">
            Opening workspace
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
