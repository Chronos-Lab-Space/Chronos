import { useState, type FormEvent } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { isWorkspaceOnboarded } from "../../../domain/workspace/onboarding";
import { authService } from "../../../infrastructure/auth/SupabaseAuthService";
import { ChronosCMark } from "../../components/ChronosCMark";
import { WorkspaceContextRail } from "./WorkspaceContextRail";
import { WorkspaceProvider, useWorkspace } from "./WorkspaceContext";
import { WorkspaceLoadingScreen } from "./WorkspaceLoadingScreen";
import { WorkspaceOnboarding } from "./WorkspaceOnboarding";

type NavItem = { to: string; label: string; short: string; end?: boolean };

/** Primary product nav — matches HQ mock (public/image.png). */
const navItems: NavItem[] = [
  { to: "/workspace", label: "Current Decision", short: "Home", end: true },
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
  const { home, loading, ownerId, error, remoteError } = useWorkspace();
  const [menuOpen, setMenuOpen] = useState(false);
  const [search, setSearch] = useState("");

  const ready = isWorkspaceOnboarded(home);
  const initials = (ownerId ?? "You").slice(0, 2).toUpperCase();
  const routeKey = location.pathname;
  const showContextRail =
    ready &&
    (location.pathname === "/workspace" || location.pathname === "/workspace/");

  const handleSignOut = async () => {
    await authService.signOut();
    navigate("/login", { replace: true });
  };

  const handleSearch = (e: FormEvent) => {
    e.preventDefault();
    const q = search.trim();
    if (!q) return;
    // Command-ish routing from HQ mock search bar
    const lower = q.toLowerCase();
    if (lower.startsWith("sim") || lower.includes("run")) {
      navigate("/workspace/simulations?new=1");
    } else if (lower.startsWith("mem")) {
      navigate("/workspace/memory");
    } else if (lower.startsWith("time")) {
      navigate("/workspace/timeline");
    } else {
      navigate(`/workspace/knowledge?q=${encodeURIComponent(q)}`);
    }
    setMenuOpen(false);
  };

  return (
    <div className="workspace-shell-enter min-h-dvh bg-bg pb-20 lg:pb-0">
      {/* Top bar — brand · command · user */}
      <header className="sticky top-0 z-40 border-b border-line bg-bg/95 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-[1600px] items-center gap-3 px-3 sm:px-4 lg:px-5">
          <div className="flex min-w-0 items-center gap-2.5">
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
            <ChronosCMark size={22} className="chronos-brand-mark shrink-0 text-ink" />
            <div className="min-w-0">
              <div className="flex items-baseline gap-1.5">
                <span className="font-chronos-wordmark text-[18px] leading-none text-ink sm:text-[20px]">
                  Chronos
                </span>
                <span className="hidden font-mono text-[9px] uppercase tracking-[0.2em] text-ink-faint sm:inline">
                  Lab
                </span>
              </div>
            </div>
          </div>

          {ready && (
            <form
              onSubmit={handleSearch}
              className="mx-auto hidden min-w-0 flex-1 max-w-xl md:block"
              role="search"
            >
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-[10px] text-ink-faint">
                  ⌘K
                </span>
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search, ask, or run a command…"
                  className="w-full rounded-full border border-line bg-bg-soft/25 py-2 pl-12 pr-4 text-sm text-ink placeholder:text-ink-faint outline-none focus:border-chronos/50"
                />
              </div>
            </form>
          )}

          <div className="ml-auto flex shrink-0 items-center gap-2">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-full border border-line font-mono text-[10px] text-chronos"
              title={ownerId ?? "You"}
            >
              {initials}
            </div>
            <button
              type="button"
              onClick={() => void handleSignOut()}
              aria-label="Sign out"
              className="hidden rounded-full border border-line px-3 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-dim transition hover:border-chronos/40 hover:text-ink sm:inline-flex"
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
                      isActive
                        ? "bg-chronos/15 text-chronos"
                        : "text-ink-dim hover:bg-bg-soft/40 hover:text-ink"
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              ))}
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  void handleSignOut();
                }}
                className="mt-1 rounded-md border border-line px-3 py-3 text-left text-[15px] text-ink-dim transition hover:bg-bg-soft/40 hover:text-ink"
              >
                Sign out
              </button>
            </div>
          </nav>
        )}
      </header>

      {remoteError && (
        <div
          role="status"
          className="border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-center text-[13px] text-amber-100/90"
        >
          Cloud sync failed — decisions are saved on this device.{" "}
          <span className="font-mono text-[11px] text-ink-faint">
            {remoteError.length > 120 ? `${remoteError.slice(0, 120)}…` : remoteError}
          </span>
        </div>
      )}

      <div className="mx-auto flex max-w-[1600px]">
        {/* Left workspace nav */}
        {ready && (
          <aside className="sticky top-14 hidden h-[calc(100dvh-3.5rem)] w-[220px] shrink-0 border-r border-line lg:flex lg:flex-col">
            <nav className="flex h-full flex-col gap-0.5 p-3" aria-label="Workspace">
              <div className="mb-2 px-3 pt-2 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-faint">
                Workspace
              </div>
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    `workspace-nav-active rounded-lg px-3 py-2.5 text-[13px] transition ${
                      isActive
                        ? "bg-chronos/15 font-medium text-chronos"
                        : "text-ink-dim hover:bg-bg-soft/30 hover:text-ink"
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              ))}

              <div className="mt-auto space-y-3 border-t border-line px-1 pt-4 pb-2">
                <div className="rounded-xl border border-line bg-bg-soft/20 p-3">
                  <div className="font-mono text-[9px] uppercase tracking-[0.16em] text-ink-faint">
                    Current decision
                  </div>
                  <div className="mt-1.5 line-clamp-2 text-sm text-ink">
                    {home?.goal?.title ?? "No goal yet"}
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="inline-flex h-1.5 w-1.5 rounded-full bg-chronos" />
                    <span className="font-mono text-[10px] uppercase text-ink-faint">
                      {home?.recentSimulations[0]?.status ?? "Planning"}
                    </span>
                  </div>
                  <NavLink
                    to="/workspace"
                    end
                    className="mt-3 inline-flex font-mono text-[10px] uppercase tracking-[0.12em] text-chronos"
                  >
                    View decision brief →
                  </NavLink>
                </div>
                <div className="px-2 pb-1">
                  <div className="flex items-center gap-2 text-ink-dim">
                    <ChronosCMark size={16} className="text-ink-faint" />
                    <div>
                      <div className="text-[11px] text-ink-dim">Chronos Lab</div>
                      <div className="font-mono text-[9px] text-ink-faint">
                        Decision infrastructure
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </nav>
          </aside>
        )}

        <main className="min-w-0 flex-1 px-4 py-5 sm:px-5 sm:py-6 lg:px-6">
          {error && (
            <div className="workspace-banner-enter mb-4 rounded-xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-[13px] text-ink-dim">
              {error}
            </div>
          )}
          {loading && !home ? (
            <WorkspaceLoadingScreen message="Opening decision workspace…" />
          ) : !ready ? (
            <div key="onboarding" className="page-enter">
              <WorkspaceOnboarding />
              {loading ? (
                <p className="mt-4 text-center font-mono text-[10px] uppercase text-ink-faint">
                  Syncing…
                </p>
              ) : null}
            </div>
          ) : (
            <div key={routeKey} className="page-enter">
              {loading ? (
                <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint">
                  Syncing workspace…
                </p>
              ) : null}
              <Outlet />
            </div>
          )}
        </main>

        {showContextRail && home ? <WorkspaceContextRail home={home} /> : null}
      </div>

      {ready && (
        <nav
          className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-bg/95 backdrop-blur-xl lg:hidden"
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
          aria-label="Workspace"
        >
          <div className="mx-auto grid max-w-6xl grid-cols-6 gap-0 px-0.5 py-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                aria-label={item.label}
                className={({ isActive }) =>
                  `workspace-nav-active flex min-h-11 flex-col items-center justify-center rounded-lg px-0.5 py-1.5 font-mono text-[9px] uppercase tracking-[0.02em] transition sm:text-[10px] ${
                    isActive
                      ? "bg-chronos/10 text-chronos"
                      : "text-ink-faint hover:text-ink-dim"
                  }`
                }
              >
                <span className="max-w-full truncate">{item.short}</span>
              </NavLink>
            ))}
          </div>
        </nav>
      )}
    </div>
  );
}
