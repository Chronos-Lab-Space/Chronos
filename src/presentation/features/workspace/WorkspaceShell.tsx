import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { authService } from "../../../infrastructure/auth/SupabaseAuthService";
import { ChronosCMark } from "../../components/ChronosCMark";
import { WorkspaceProvider, useWorkspace } from "./WorkspaceContext";
import { WorkspaceOnboarding } from "./WorkspaceOnboarding";

const navItems = [
  { to: "/workspace", label: "Dashboard", end: true },
  { to: "/workspace/simulations", label: "Sims", end: false },
  { to: "/workspace/memory", label: "Memory", end: false },
  { to: "/workspace/advisor", label: "Grok", end: false },
  { to: "/workspace/settings", label: "Settings", end: false },
] as const;

/**
 * Workspace chrome — mobile-first header + bottom nav on small screens.
 */
export function WorkspaceShell() {
  return (
    <WorkspaceProvider>
      <WorkspaceShellInner />
    </WorkspaceProvider>
  );
}

function WorkspaceShellInner() {
  const navigate = useNavigate();
  const { home, loading } = useWorkspace();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleSignOut = async () => {
    await authService.signOut();
    navigate("/login", { replace: true });
  };

  const ready = Boolean(home?.workspace && home.goal);

  return (
    <div className="min-h-dvh bg-bg pb-20 md:pb-0">
      <header className="sticky top-0 z-40 border-b border-line bg-bg/95 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between gap-2 px-4 sm:px-5">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            {ready && (
              <button
                type="button"
                aria-label="Open menu"
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen((v) => !v)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-line text-ink-dim transition hover:border-line-strong hover:text-ink md:hidden"
              >
                <span className="font-mono text-base leading-none">{menuOpen ? "×" : "☰"}</span>
              </button>
            )}
            <div className="flex min-w-0 items-center gap-2">
              <ChronosCMark size={22} className="chronos-brand-mark shrink-0" />
              <div className="min-w-0">
                <div className="font-chronos-wordmark text-[18px] leading-none text-ink sm:text-[20px]">
                  Chronos
                </div>
                <div className="mt-0.5 truncate text-[11px] text-ink-dim sm:text-[12px]">
                  {home ? home.workspace.name : "Workspace"}
                </div>
              </div>
            </div>
          </div>

          {/* Desktop nav */}
          {ready && (
            <nav className="hidden items-center gap-0.5 md:flex" aria-label="Workspace">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    `rounded-full px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] transition ${
                      isActive
                        ? "bg-chronos/15 text-chronos"
                        : "text-ink-dim hover:bg-bg-soft/40 hover:text-ink"
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>
          )}

          <button
            type="button"
            onClick={handleSignOut}
            className="shrink-0 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-dim transition hover:text-ink"
          >
            Out
          </button>
        </div>

        {/* Mobile drawer */}
        {ready && menuOpen && (
          <nav className="border-t border-line bg-bg md:hidden" aria-label="Workspace menu">
            <div className="mx-auto flex max-w-3xl flex-col gap-0.5 px-3 py-2">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  onClick={() => setMenuOpen(false)}
                  className={({ isActive }) =>
                    `rounded-md px-3 py-3 text-[15px] transition ${
                      isActive
                        ? "bg-chronos/15 text-chronos"
                        : "text-ink-dim hover:bg-bg-soft/40 hover:text-ink"
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              ))}
              <NavLink
                to="/workspace/settings"
                onClick={() => setMenuOpen(false)}
                className="rounded-md px-3 py-3 text-[15px] text-chronos"
              >
                + New workspace
              </NavLink>
            </div>
          </nav>
        )}
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6 sm:px-5 sm:py-8">
        {loading ? (
          <div className="flex min-h-[40vh] items-center justify-center">
            <div className="text-center">
              <div className="mx-auto h-6 w-6 rounded-full border border-chronos border-t-transparent animate-spin" />
              <div className="mt-4 font-mono text-[10px] uppercase tracking-[0.24em] text-ink-faint">
                Loading workspace
              </div>
            </div>
          </div>
        ) : !ready ? (
          <WorkspaceOnboarding />
        ) : (
          <Outlet />
        )}
      </main>

      {/* Mobile bottom nav */}
      {ready && (
        <nav
          className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-bg/95 backdrop-blur-xl md:hidden"
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
          aria-label="Workspace mobile"
        >
          <div className="mx-auto grid max-w-3xl grid-cols-5 gap-0 px-1 py-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `flex flex-col items-center justify-center rounded-lg px-1 py-2 font-mono text-[9px] uppercase tracking-[0.08em] ${
                    isActive ? "text-chronos" : "text-ink-faint"
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </div>
        </nav>
      )}
    </div>
  );
}
