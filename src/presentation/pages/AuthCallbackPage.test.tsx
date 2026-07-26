import { render, screen, waitFor } from "@testing-library/react";
import type { AuthChangeEvent, Session, User } from "@supabase/supabase-js";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const navigate = vi.fn();
const ensureAccount = vi.fn();
const trackProductEvent = vi.fn();
const currentUser = vi.fn();
const currentSession = vi.fn();

let authListener: ((event: AuthChangeEvent, session: Session | null) => void) | null = null;
const unsubscribe = vi.fn();

vi.mock("react-router-dom", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-router-dom")>()),
  useNavigate: () => navigate,
}));

vi.mock("../../infrastructure/auth/SupabaseAuthService", () => ({
  authService: {
    currentUser: () => currentUser(),
    currentSession: () => currentSession(),
    onAuthStateChange: (listener: (event: AuthChangeEvent, session: Session | null) => void) => {
      authListener = listener;
      return { data: { subscription: { unsubscribe } } };
    },
  },
}));

vi.mock("../../application/workspace/AccountBootstrapService", () => ({
  accountBootstrapService: { ensureAccount: (user: User) => ensureAccount(user) },
}));

vi.mock("../../infrastructure/analytics/productAnalytics", () => ({
  trackProductEvent: (...args: unknown[]) => trackProductEvent(...args),
}));

import { AuthCallbackPage } from "./AuthCallbackPage";

const USER = { id: "user-1", app_metadata: { provider: "google" } } as unknown as User;
const SESSION = { user: USER } as unknown as Session;

/** A promise whose resolution the test controls, so both entry paths can be
 *  in flight at the same time. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

describe("AuthCallbackPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authListener = null;
    ensureAccount.mockResolvedValue({ home: null });
  });

  it("shows the brand loading screen while completing sign-in", () => {
    currentSession.mockReturnValue(new Promise(() => {}));
    currentUser.mockReturnValue(new Promise(() => {}));

    render(
      <MemoryRouter>
        <AuthCallbackPage />
      </MemoryRouter>
    );

    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-busy", "true");
    expect(screen.getByText("Completing sign-in")).toBeInTheDocument();
  });

  it("bootstraps and navigates once when the listener and the session check race", async () => {
    const user = deferred<User>();
    currentSession.mockResolvedValue(SESSION);
    currentUser.mockReturnValue(user.promise);

    render(
      <MemoryRouter>
        <AuthCallbackPage />
      </MemoryRouter>
    );

    // The listener fires while finishSignIn's own session check is still
    // pending, so both paths call enterWorkspace before either resolves.
    await waitFor(() => expect(authListener).not.toBeNull());
    authListener?.("INITIAL_SESSION", SESSION);
    await Promise.resolve();
    user.resolve(USER);

    await waitFor(() => expect(navigate).toHaveBeenCalledWith("/workspace", { replace: true }));

    expect(ensureAccount).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(
      trackProductEvent.mock.calls.filter(([event]) => event === "session_start")
    ).toHaveLength(1);
  });
});
