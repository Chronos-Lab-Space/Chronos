import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { authService } from "../../../infrastructure/auth/SupabaseAuthService";
import { ChronosCMark } from "../../components/ChronosCMark";
import { WorkspaceProvider, useWorkspace } from "./WorkspaceContext";
import { WorkspaceOnboarding } from "./WorkspaceOnboarding";

const navItems = [
  { to: "/workspace", label: "Dashboard", end: true },
  { to: "/workspace/knowledge", label: "Knowledge", end: false },
  { to: "/workspace/simulations", label: "Simulations", end: false },
  { to: "/workspace/notes", label: "Notes", end: false },
  { to: "/workspace/settings", label: "Settings", end: false },
] as const;

/**
 * Minimal workspace chrome + onboarding gate for the foundation flow.
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
    <div className="min-h-screen bg-bg">
      <header className="sticky top-0 z-40 border-b border-line bg-bg/90 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between gap-3 px-5">
          <div className="flex items-center gap-3 min-w-0">
            {ready && (
              <button
                type="button"
                aria-label="Open menu"
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen((v) => !v)}
                className="flex h-9 w-9 items-center justify-center rounded-md border border-line text-ink-dim transition hover:border-line-strong hover:text-ink"
              >
                <span className="font-mono text-base leading-none">{menuOpen ? "×" : "☰"}</span>
              </button>
            )}
            <div className="flex min-w-0 items-center gap-2">
              <ChronosCMark size={22} className="chronos-brand-mark shrink-0" />
              <div className="min-w-0">
                <div className="font-chronos-wordmark text-[20px] leading-none text-ink">Chronos</div>
                <div className="mt-0.5 truncate text-[12px] text-ink-dim">
                  {home ? `Workspace: ${home.workspace.name}` : "Workspace"}
                </div>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleSignOut}
            className="shrink-0 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-dim transition hover:text-ink"
          >
            Sign out
          </button>
        </div>

        {ready && menuOpen && (
          <nav className="border-t border-line bg-bg" aria-label="Workspace">
            <div className="mx-auto flex max-w-3xl flex-col gap-0.5 px-3 py-2">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  onClick={() => setMenuOpen(false)}
                  className={({ isActive }) =>
                    `rounded-md px-3 py-2.5 text-[14px] transition ${
                      isActive
                        ? "bg-chronos/15 text-chronos"
                        : "text-ink-dim hover:bg-bg-soft/40 hover:text-ink"
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </div>
          </nav>
        )}
      </header>

      <main className="mx-auto max-w-3xl px-5 py-8">
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
    </div>
  );
}
