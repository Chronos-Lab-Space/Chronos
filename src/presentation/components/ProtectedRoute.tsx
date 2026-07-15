import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { authService } from "../../infrastructure/auth/SupabaseAuthService";

/**
 * Route guard: redirects to home if user is not authenticated.
 * Shows loading state while checking auth status.
 */
export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function checkAuth() {
      const user = await authService.currentUser();
      if (isMounted) {
        setIsAuthenticated(!!user);
      }
    }

    checkAuth();

    return () => {
      isMounted = false;
    };
  }, []);

  if (isAuthenticated === null) {
    return (
      <div className="flex min-h-[45vh] items-center justify-center bg-bg">
        <div className="text-center">
          <div className="mx-auto h-6 w-6 rounded-full border border-chronos border-t-transparent animate-spin" />
          <div className="mt-4 font-mono text-[10px] uppercase tracking-[0.24em] text-ink-faint">
            Checking access
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
