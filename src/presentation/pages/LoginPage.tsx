import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { authService, formatAuthError } from "../../infrastructure/auth/SupabaseAuthService";
import { trackProductEvent } from "../../infrastructure/analytics/productAnalytics";

type AuthMode = "oauth" | "password" | "magic";

/**
 * Public beta entry: Google / GitHub first, email secondary.
 * Landing → Get Started → here → OAuth → bootstrap → workspace.
 */
export function LoginPage() {
  const [searchParams] = useSearchParams();
  const intentStart = searchParams.get("intent") === "start";
  const [mode, setMode] = useState<AuthMode>("oauth");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<"google" | "github" | null>(null);
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

  const handleOAuth = async (provider: "google" | "github") => {
    setOauthLoading(provider);
    showMessage("");
    try {
      trackProductEvent("session_start", { oauth: provider, intent: intentStart ? "start" : "login" });
      const redirectTo = `${window.location.origin}/auth/callback`;
      const { error } = await authService.signInWithOAuth(provider, redirectTo);
      if (error) {
        showMessage(formatAuthError(error.message), true);
        setOauthLoading(null);
      }
      // Browser redirects away on success
    } catch {
      showMessage("Could not start OAuth. Check Supabase provider settings.", true);
      setOauthLoading(null);
    }
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
      const redirectTo = `${window.location.origin}/auth/callback`;
      const { error } = await authService.signInWithMagicLink(email.trim(), redirectTo);
      if (error) {
        const friendly = formatAuthError(error.message);
        showMessage(friendly, true);
        if (error.message.toLowerCase().includes("rate limit")) {
          setCooldownUntil(Date.now() + 60_000);
        }
        return;
      }
      showMessage("Check your email for a login link. It may take a minute to arrive.");
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
        <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-chronos">
          {intentStart ? "Get started" : "Sign in"}
        </div>
        <h1 className="mt-2 font-serif text-4xl text-ink">
          {intentStart ? "Start deciding" : "Welcome back"}
        </h1>
        <p className="mt-2 text-sm text-ink-dim">
          {intentStart
            ? "Create your workspace, set a decision, and run your first simulation."
            : "Access your Chronos Decision Workspace."}
        </p>

        {/* OAuth primary */}
        <div className="mt-8 space-y-3">
          <button
            type="button"
            disabled={Boolean(oauthLoading)}
            onClick={() => void handleOAuth("google")}
            className="flex w-full items-center justify-center gap-3 rounded-full border border-line bg-bg px-4 py-3 text-sm font-medium text-ink transition hover:border-chronos/40 hover:bg-chronos/5 disabled:opacity-50"
          >
            <GoogleIcon />
            {oauthLoading === "google" ? "Redirecting…" : "Continue with Google"}
          </button>
          <button
            type="button"
            disabled={Boolean(oauthLoading)}
            onClick={() => void handleOAuth("github")}
            className="flex w-full items-center justify-center gap-3 rounded-full border border-line bg-bg px-4 py-3 text-sm font-medium text-ink transition hover:border-chronos/40 hover:bg-chronos/5 disabled:opacity-50"
          >
            <GitHubIcon />
            {oauthLoading === "github" ? "Redirecting…" : "Continue with GitHub"}
          </button>
        </div>

        <div className="my-6 flex items-center gap-3">
          <div className="h-px flex-1 bg-line" />
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint">
            or email
          </span>
          <div className="h-px flex-1 bg-line" />
        </div>

        <div className="flex rounded-lg border border-line p-1">
          <button
            type="button"
            onClick={() => {
              setMode("password");
              showMessage("");
            }}
            className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition ${
              mode === "password" || mode === "oauth"
                ? mode === "password"
                  ? "bg-ink text-bg"
                  : "text-ink-dim hover:text-ink"
                : "text-ink-dim hover:text-ink"
            } ${mode === "password" ? "bg-ink text-bg" : "text-ink-dim hover:text-ink"}`}
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

        {mode === "magic" ? (
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
              className="w-full rounded-full bg-ink px-4 py-2.5 font-medium text-bg transition hover:bg-chronos disabled:opacity-50"
            >
              {loading
                ? "Sending..."
                : onCooldown
                  ? `Wait ${cooldownSeconds}s`
                  : "Send magic link"}
            </button>
          </form>
        ) : (
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
              className="w-full rounded-full bg-ink px-4 py-2.5 font-medium text-bg transition hover:bg-chronos disabled:opacity-50"
            >
              {loading ? "Signing in..." : "Sign in with email"}
            </button>
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

        <p className="mt-6 text-center text-xs text-ink-faint">
          By continuing you agree to Chronos{" "}
          <Link to="/terms" className="text-chronos hover:underline">
            Terms
          </Link>{" "}
          and{" "}
          <Link to="/privacy" className="text-chronos hover:underline">
            Privacy
          </Link>
          .
        </p>
        <p className="mt-3 text-center text-sm text-ink-dim">
          <Link to="/" className="text-chronos hover:underline">
            ← Back to home
          </Link>
        </p>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58Z"
      />
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}
