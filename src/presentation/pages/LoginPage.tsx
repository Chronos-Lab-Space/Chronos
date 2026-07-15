import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { authService, formatAuthError } from "../../infrastructure/auth/SupabaseAuthService";

type AuthMode = "password" | "magic";

/**
 * Dashboard sign-in. Password is the primary path (no email quota). Magic link
 * is available when Supabase email delivery is not rate-limited.
 */
export function LoginPage() {
  const [mode, setMode] = useState<AuthMode>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [now, setNow] = useState(Date.now());
  const navigate = useNavigate();

  const cooldownSeconds = Math.max(0, Math.ceil((cooldownUntil - now) / 1000));
  const onCooldown = cooldownSeconds > 0;

  useEffect(() => {
    if (!onCooldown) return;
    const id = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(id);
  }, [onCooldown]);

  useEffect(() => {
    let isMounted = true;

    async function redirectIfSignedIn() {
      const session = await authService.currentSession();
      if (isMounted && session?.user) {
        navigate("/workspace", { replace: true });
      }
    }

    redirectIfSignedIn();

    const { data } = authService.onAuthStateChange((event, session) => {
      if (!isMounted) return;
      if (session?.user && (event === "SIGNED_IN" || event === "INITIAL_SESSION")) {
        navigate("/workspace", { replace: true });
      }
    });

    return () => {
      isMounted = false;
      data.subscription.unsubscribe();
    };
  }, [navigate]);

  const showMessage = (text: string, error = false) => {
    setMessage(text);
    setIsError(error);
  };

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    showMessage("");

    try {
      const { error } = await authService.signInWithPassword(email.trim(), password);
      if (error) {
        showMessage(formatAuthError(error.message), true);
        return;
      }
      navigate("/workspace", { replace: true });
    } catch {
      showMessage("Failed to sign in", true);
    } finally {
      setLoading(false);
    }
  };

  const handleMagicLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (onCooldown) return;

    setLoading(true);
    showMessage("");

    try {
      // Must be listed under Supabase Auth → URL Configuration → Redirect URLs.
      const redirectTo = `${window.location.origin}/auth/callback`;
      const { error } = await authService.signInWithMagicLink(email.trim(), redirectTo);
      if (error) {
        const friendly = formatAuthError(error.message);
        showMessage(friendly, true);
        if (error.message.toLowerCase().includes("rate limit")) {
          // Prevent hammering the free email provider.
          setCooldownUntil(Date.now() + 60_000);
        }
        return;
      }
      showMessage("Check your email for a login link. It may take a minute to arrive.");
      // Soft cooldown so double-clicks do not burn the hourly quota.
      setCooldownUntil(Date.now() + 60_000);
    } catch {
      showMessage("Failed to send login link", true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-6">
      <div className="w-full max-w-md rounded-2xl border border-line bg-bg-soft p-8">
        <h1 className="font-serif text-4xl text-ink">Sign in</h1>
        <p className="mt-2 text-sm text-ink-dim">Access your Chronos workspace dashboard</p>

        <div className="mt-6 flex rounded-lg border border-line p-1">
          <button
            type="button"
            onClick={() => {
              setMode("password");
              showMessage("");
            }}
            className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition ${
              mode === "password" ? "bg-ink text-bg" : "text-ink-dim hover:text-ink"
            }`}
          >
            Password
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("magic");
              showMessage("");
            }}
            className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition ${
              mode === "magic" ? "bg-ink text-bg" : "text-ink-dim hover:text-ink"
            }`}
          >
            Magic link
          </button>
        </div>

        {mode === "password" ? (
          <form onSubmit={handlePasswordLogin} className="mt-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-ink" htmlFor="login-email">
                Email
              </label>
              <input
                id="login-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="mt-2 w-full rounded-lg border border-line bg-bg px-4 py-2 text-ink placeholder-ink-faint focus:border-chronos focus:outline-none"
                placeholder="your@email.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-ink" htmlFor="login-password">
                Password
              </label>
              <input
                id="login-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                autoComplete="current-password"
                className="mt-2 w-full rounded-lg border border-line bg-bg px-4 py-2 text-ink placeholder-ink-faint focus:border-chronos focus:outline-none"
                placeholder="••••••••"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-ink px-4 py-2 font-medium text-bg transition hover:bg-chronos disabled:opacity-50"
            >
              {loading ? "Signing in..." : "Sign in"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleMagicLogin} className="mt-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-ink" htmlFor="magic-email">
                Email
              </label>
              <input
                id="magic-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="mt-2 w-full rounded-lg border border-line bg-bg px-4 py-2 text-ink placeholder-ink-faint focus:border-chronos focus:outline-none"
                placeholder="your@email.com"
              />
            </div>
            <button
              type="submit"
              disabled={loading || onCooldown}
              className="w-full rounded-lg bg-ink px-4 py-2 font-medium text-bg transition hover:bg-chronos disabled:opacity-50"
            >
              {loading
                ? "Sending..."
                : onCooldown
                  ? `Wait ${cooldownSeconds}s`
                  : "Send magic link"}
            </button>
            <p className="text-xs text-ink-faint">
              Free Supabase email is limited to a few messages per hour. Prefer password sign-in
              while testing.
            </p>
          </form>
        )}

        {message && (
          <div
            className={`mt-4 rounded-lg p-3 text-sm ${
              isError ? "bg-red-500/10 text-red-600" : "bg-chronos/10 text-chronos"
            }`}
          >
            {message}
          </div>
        )}

        <p className="mt-6 text-center text-sm text-ink-dim">
          <Link to="/" className="text-chronos transition hover:underline">
            ← Back to home
          </Link>
        </p>
      </div>
    </div>
  );
}
