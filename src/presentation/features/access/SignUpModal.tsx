import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { authService, formatAuthError } from "../../../infrastructure/auth/SupabaseAuthService";
import { trackProductEvent } from "../../../infrastructure/analytics/productAnalytics";

type SignUpModalContextValue = {
  openSignUpModal: () => void;
  closeSignUpModal: () => void;
};

const SignUpModalContext = createContext<SignUpModalContextValue | null>(null);

export function useSignUpModal() {
  const context = useContext(SignUpModalContext);
  if (!context) {
    throw new Error("useSignUpModal must be used inside SignUpModalProvider.");
  }
  return context;
}

/** @deprecated Use useSignUpModal — kept so older call sites keep compiling during rename. */
export const useAccessModal = () => {
  const { openSignUpModal, closeSignUpModal } = useSignUpModal();
  return {
    openAccessModal: openSignUpModal,
    closeAccessModal: closeSignUpModal,
  };
};

/** Site-wide public beta signup gate — OAuth / email, not a waitlist form. */
export function SignUpModalProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <SignUpModalContext.Provider
      value={{
        openSignUpModal: () => setOpen(true),
        closeSignUpModal: () => setOpen(false),
      }}
    >
      {children}
      {open && <SignUpModal onClose={() => setOpen(false)} />}
    </SignUpModalContext.Provider>
  );
}

/** @deprecated Prefer SignUpModalProvider */
export const AccessModalProvider = SignUpModalProvider;

type AuthTab = "signup" | "signin" | "magic";

function SignUpModal({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const [visible, setVisible] = useState(false);
  const [tab, setTab] = useState<AuthTab>("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<"google" | "github" | null>(null);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [now, setNow] = useState(Date.now());

  const cooldownSeconds = Math.max(0, Math.ceil((cooldownUntil - now) / 1000));
  const onCooldown = cooldownSeconds > 0;

  useEffect(() => {
    const frame = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!onCooldown) return;
    const id = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(id);
  }, [onCooldown]);

  useEffect(() => {
    let mounted = true;
    const { data } = authService.onAuthStateChange((event, session) => {
      if (!mounted) return;
      if (session?.user && (event === "SIGNED_IN" || event === "INITIAL_SESSION")) {
        onClose();
        navigate("/workspace", { replace: true });
      }
    });
    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, [navigate, onClose]);

  const showMessage = (text: string, error = false) => {
    setMessage(text);
    setIsError(error);
  };

  const redirectTo = `${window.location.origin}/auth/callback`;

  const handleOAuth = async (provider: "google" | "github") => {
    setOauthLoading(provider);
    showMessage("");
    try {
      trackProductEvent("session_start", { oauth: provider, intent: "public_beta" });
      const { error } = await authService.signInWithOAuth(provider, redirectTo);
      if (error) {
        showMessage(formatAuthError(error.message), true);
        setOauthLoading(null);
      }
    } catch {
      showMessage("Could not start OAuth. Check Supabase provider settings.", true);
      setOauthLoading(null);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    showMessage("");
    try {
      trackProductEvent("session_start", { method: "signup", intent: "public_beta" });
      const { data, error } = await authService.signUpWithPassword(
        email.trim(),
        password,
        redirectTo
      );
      if (error) {
        showMessage(formatAuthError(error.message), true);
        return;
      }
      if (data.session?.user) {
        onClose();
        navigate("/workspace", { replace: true });
        return;
      }
      showMessage(
        "Account created. Check your email to confirm, then sign in — or continue if confirmation is disabled."
      );
    } catch {
      showMessage("Could not create account.", true);
    } finally {
      setLoading(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    showMessage("");
    try {
      trackProductEvent("session_start", { method: "password", intent: "public_beta" });
      const { error } = await authService.signInWithPassword(email.trim(), password);
      if (error) {
        showMessage(formatAuthError(error.message), true);
        return;
      }
      onClose();
      navigate("/workspace", { replace: true });
    } catch {
      showMessage("Failed to sign in.", true);
    } finally {
      setLoading(false);
    }
  };

  const handleMagic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (onCooldown) return;
    setLoading(true);
    showMessage("");
    try {
      trackProductEvent("session_start", { method: "magic", intent: "public_beta" });
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
      showMessage("Failed to send login link.", true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className={`fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto p-4 pb-8 pt-8 transition-opacity duration-300 sm:items-center ${
        visible ? "opacity-100" : "opacity-0"
      }`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="signup-modal-title"
    >
      <button
        type="button"
        aria-label="Close join public beta"
        className="absolute inset-0 cursor-default bg-[#111111]/85 backdrop-blur-md"
        onClick={onClose}
      />

      <div
        className={`relative z-10 w-full max-w-md rounded-2xl border border-line bg-bg-soft shadow-2xl transition-all duration-300 ${
          visible ? "translate-y-0 scale-100" : "translate-y-5 scale-[0.98]"
        }`}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full border border-line text-ink-dim transition hover:border-line-strong hover:text-ink"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path
              d="M3 3l8 8M11 3l-8 8"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </button>

        <div className="p-6 sm:p-8">
          <div className="mb-4 flex items-center gap-3">
            <div className="h-px w-8 bg-chronos/60" />
            <span className="font-mono text-[10px] uppercase tracking-[0.24em] text-chronos">
              Public beta
            </span>
            <div className="h-px w-8 bg-chronos/60" />
          </div>
          <h2
            id="signup-modal-title"
            className="font-serif text-3xl leading-[1] text-ink sm:text-4xl"
          >
            Join the public beta<span className="text-ink-faint">.</span>
          </h2>
          <p className="mt-3 text-[14px] leading-[1.7] text-ink-dim">
            Create a free Chronos account. You get a Decision Workspace — goals, simulations,
            futures, and memory.
          </p>

          <div className="mt-6 space-y-3">
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

          <div className="my-5 flex items-center gap-3">
            <div className="h-px flex-1 bg-line" />
            <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint">
              or email
            </span>
            <div className="h-px flex-1 bg-line" />
          </div>

          <div className="flex rounded-lg border border-line p-1">
            {(
              [
                ["signup", "Sign up"],
                ["signin", "Sign in"],
                ["magic", "Magic link"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => {
                  setTab(id);
                  showMessage("");
                }}
                className={`flex-1 rounded-md px-2 py-2 text-xs font-medium transition sm:text-sm ${
                  tab === id ? "bg-ink text-bg" : "text-ink-dim hover:text-ink"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {tab === "magic" ? (
            <form onSubmit={handleMagic} className="mt-5 space-y-3">
              <Field
                id="beta-magic-email"
                label="Email"
                type="email"
                value={email}
                onChange={setEmail}
                autoComplete="email"
              />
              <button
                type="submit"
                disabled={loading || onCooldown}
                className="w-full rounded-full bg-ink px-4 py-2.5 text-sm font-medium text-bg transition hover:bg-chronos disabled:opacity-50"
              >
                {loading ? "Sending…" : onCooldown ? `Wait ${cooldownSeconds}s` : "Send magic link"}
              </button>
            </form>
          ) : (
            <form
              onSubmit={tab === "signup" ? handleSignUp : handleSignIn}
              className="mt-5 space-y-3"
            >
              <Field
                id="beta-email"
                label="Email"
                type="email"
                value={email}
                onChange={setEmail}
                autoComplete="email"
              />
              <Field
                id="beta-password"
                label="Password"
                type="password"
                value={password}
                onChange={setPassword}
                autoComplete={tab === "signup" ? "new-password" : "current-password"}
                minLength={8}
              />
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-full bg-ink px-4 py-2.5 text-sm font-medium text-bg transition hover:bg-chronos disabled:opacity-50"
              >
                {loading
                  ? tab === "signup"
                    ? "Creating…"
                    : "Signing in…"
                  : tab === "signup"
                    ? "Create account"
                    : "Sign in"}
              </button>
            </form>
          )}

          {message && (
            <div
              className={`mt-4 rounded-lg p-3 text-sm ${
                isError ? "bg-red-500/10 text-red-500" : "bg-chronos/10 text-chronos"
              }`}
            >
              {message}
            </div>
          )}

          <p className="mt-5 text-center text-xs text-ink-faint">
            By continuing you agree to Chronos{" "}
            <Link to="/terms" onClick={onClose} className="text-chronos hover:underline">
              Terms
            </Link>{" "}
            and{" "}
            <Link to="/privacy" onClick={onClose} className="text-chronos hover:underline">
              Privacy
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  );
}

function Field({
  id,
  label,
  type,
  value,
  onChange,
  autoComplete,
  minLength,
}: {
  id: string;
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete?: string;
  minLength?: number;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-ink" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required
        minLength={minLength}
        autoComplete={autoComplete}
        className="mt-2 w-full rounded-lg border border-line bg-bg px-4 py-2 text-sm text-ink placeholder-ink-faint focus:border-chronos focus:outline-none"
        placeholder={type === "password" ? "••••••••" : "you@company.com"}
      />
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
