import { useState, type FormEvent } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { isWorkspaceOnboarded } from "../../../domain/workspace/onboarding";
import { authService } from "../../../infrastructure/auth/SupabaseAuthService";
import { ChronosCMark } from "../../components/ChronosCMark";
import { WorkspaceProvider, useWorkspace } from "./WorkspaceContext";
import { WorkspaceOnboarding } from "./WorkspaceOnboarding";

type NavItem = { to: string; label: string; short: string; end?: boolean };

/** Primary product nav — Memory stays visible after the first decision. */
const navItems: NavItem[] = [
  { to: "/workspace", label: "Dashboard", short: "Home", end: true },
  { to: "/workspace/knowledge", label: "Knowledge", short: "Know" },
  { to: "/workspace/simulations", label: "Simulations", short: "Sims" },
  { to: "/workspace/timeline", label: "Timeline", short: "Time" },
  { to: "/workspace/memory", label: "Memory", short: "Mem" },
  { to: "/workspace/settings", label: "Settings", short: "Set" },
];

export function WorkspaceShell() {
  return (
    <WorkspaceProvider>
      <WorkspaceShellInner />
    </WorkspaceProvider>
  );
}

function WorkspaceShellInner() {
  const navigate = useNavigate();
  const location = useLocation();
  const { home, loading, ownerId, error } = useWorkspace();
  const [menuOpen, setMenuOpen] = useState(false);
  const [search, setSearch] = useState("");

  const ready = isWorkspaceOnboarded(home);
  const initials = (ownerId ?? "You").slice(0, 2).toUpperCase();
  const routeKey = location.pathname;

  const handleSignOut = async () => {
    await authService.signOut();
    navigate("/login", { replace: true });
  };

  const handleSearch = (e: FormEvent) => {
    e.preventDefault();
    const q = search.trim();
    navigate(q ? `/workspace/knowledge?q=${encodeURIComponent(q)}` : "/workspace/knowledge");
    setMenuOpen(false);
  };

  return (
    <div className="min-h-dvh bg-bg pb-20 md:pb-0">
      <header className="sticky top-0 z-40 border-b border-line bg-bg/95 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4 sm:px-5 lg:px-6">
          <div className="flex min-w-0 items-center gap-2">
            {ready && (
              <button
                type="button"
                aria-label="Open menu"
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen((v) => !v)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-line text-ink-dim lg:hidden"
              >
                <span className="font-mono text-base">{menuOpen ? "×" : "☰"}</span>
              </button>
            )}
            <ChronosCMark size={22} className="chronos-brand-mark shrink-0" />
            <div className="min-w-0">
              <div className="font-chronos-wordmark text-[18px] leading-none text-ink sm:text-[20px]">
                Chronos
              </div>
              <div className="mt-0.5 hidden truncate text-[11px] text-ink-dim sm:block">
                {home ? home.workspace.name : "Workspace"}
              </div>
            </div>
          </div>

          {ready && (
            <form onSubmit={handleSearch} className="mx-auto hidden min-w-0 flex-1 max-w-md md:block" role="search">
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search knowledge…"
                className="w-full rounded-full border border-line bg-bg-soft/30 px-4 py-2 text-sm text-ink placeholder:text-ink-faint outline-none focus:border-chronos/50"
              />
            </form>
          )}

          <div className="ml-auto flex shrink-0 items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-full border border-line font-mono text-[10px] text-chronos">
              {initials}
            </div>
            <button
              type="button"
              onClick={handleSignOut}
              className="hidden font-mono text-[10px] uppercase tracking-[0.16em] text-ink-dim hover:text-ink sm:inline"
            >
              Sign out
            </button>
          </div>
        </div>

        {ready && menuOpen && (
          <nav
            className="workspace-drawer-enter border-t border-line bg-bg lg:hidden"
            aria-label="Menu"
          >
            <div className="mx-auto flex max-w-6xl flex-col gap-0.5 px-3 py-2">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  onClick={() => setMenuOpen(false)}
                  className={({ isActive }) =>
                    `rounded-md px-3 py-3 text-[15px] transition ${
                      isActive ? "bg-chronos/15 text-chronos" : "text-ink-dim hover:bg-bg-soft/40 hover:text-ink"
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

      <div className="mx-auto flex max-w-6xl">
        {ready && (
          <aside className="sticky top-14 hidden h-[calc(100dvh-3.5rem)] w-52 shrink-0 border-r border-line lg:block">
            <nav className="flex h-full flex-col gap-0.5 p-3" aria-label="Workspace">
              <div className="mb-3 px-3 pt-2 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-faint">
                Navigate
              </div>
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    `workspace-nav-active rounded-lg px-3 py-2.5 text-[14px] transition ${
                      isActive
                        ? "bg-chronos/15 font-medium text-chronos"
                        : "text-ink-dim hover:bg-bg-soft/30 hover:text-ink"
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              ))}
              <div className="mt-auto border-t border-line px-3 pt-4 pb-2">
                <div className="truncate text-xs text-ink-dim">{home?.workspace.name}</div>
                <div className="mt-1 truncate font-mono text-[10px] text-ink-faint">
                  {home?.goal?.title ?? "No goal"}
                </div>
              </div>
            </nav>
          </aside>
        )}

        <main className="min-w-0 flex-1 px-4 py-6 sm:px-5 sm:py-8 lg:px-8">
          {error && (
            <div className="workspace-banner-enter mb-4 rounded-xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-[13px] text-ink-dim">
              {error}
            </div>
          )}
          {loading ? (
            <div className="page-enter flex min-h-[40vh] items-center justify-center">
              <div className="h-6 w-6 animate-spin rounded-full border border-chronos border-t-transparent" />
            </div>
          ) : !ready ? (
            <div key="onboarding" className="page-enter">
              <WorkspaceOnboarding />
            </div>
          ) : (
            <div key={routeKey} className="page-enter">
              <Outlet />
            </div>
          )}
        </main>
      </div>

      {ready && (
        <nav
          className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-bg/95 backdrop-blur-xl lg:hidden"
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        >
          <div className="mx-auto grid max-w-6xl grid-cols-6 gap-0 px-0.5 py-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `workspace-nav-active flex flex-col items-center rounded-lg py-2 font-mono text-[8px] uppercase tracking-[0.04em] transition ${
                    isActive ? "bg-chronos/10 text-chronos" : "text-ink-faint hover:text-ink-dim"
                  }`
                }
              >
                {item.short}
              </NavLink>
            ))}
          </div>
        </nav>
      )}
    </div>
  );
}
