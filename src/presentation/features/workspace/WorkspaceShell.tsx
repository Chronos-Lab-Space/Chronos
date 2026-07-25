import { useState, type FormEvent } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { isWorkspaceOnboarded } from "../../../domain/workspace/onboarding";
import { authService } from "../../../infrastructure/auth/SupabaseAuthService";
import { ChronosCMark } from "../../components/ChronosCMark";
import { WorkspaceContextRail } from "./WorkspaceContextRail";
import { WorkspaceProvider, useWorkspace } from "./WorkspaceContext";
import { WorkspaceOnboarding } from "./WorkspaceOnboarding";

type NavItem = { to: string; label: string; short: string; end?: boolean; icon: string };

/** Desktop sidebar — matches public/image.png */
const navItems: NavItem[] = [
  { to: "/workspace", label: "Current Decision", short: "Home", end: true, icon: "⌂" },
  { to: "/workspace/knowledge", label: "Knowledge", short: "Know", icon: "☰" },
  { to: "/workspace/simulations", label: "Simulations", short: "Sims", icon: "⬡" },
  { to: "/workspace/timeline", label: "Timeline", short: "Time", icon: "▤" },
  { to: "/workspace/memory", label: "Memory", short: "Mem", icon: "▣" },
  { to: "/workspace/settings", label: "Settings", short: "Set", icon: "⚙" },
];

/** Mobile tab bar — matches public/mobile.png: Home · Sims · + · Timeline · More */
const mobilePrimary = [
  { to: "/workspace", label: "Home", end: true, icon: "⌂" },
  { to: "/workspace/simulations", label: "Simulations", icon: "⬡" },
] as const;

const mobileSecondary = [
  { to: "/workspace/timeline", label: "Timeline", icon: "▤" },
] as const;

const moreMenuItems: NavItem[] = [
  { to: "/workspace/knowledge", label: "Knowledge", short: "Know", icon: "☰" },
  { to: "/workspace/memory", label: "Memory", short: "Mem", icon: "▣" },
  { to: "/workspace/settings", label: "Settings", short: "Set", icon: "⚙" },
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
  const [moreOpen, setMoreOpen] = useState(false);
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
    setMoreOpen(false);
  };

  return (
    <div className="workspace-shell-enter min-h-dvh bg-bg pb-[5.25rem] lg:pb-0">
      {/* Top bar */}
      <header className="sticky top-0 z-40 border-b border-line bg-bg/95 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-[1600px] items-center gap-3 px-3 sm:px-4 lg:px-5">
          <div className="flex min-w-0 items-center gap-2.5">
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
        {/* Desktop left nav */}
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

        <main className="min-w-0 flex-1 overflow-x-hidden px-3 py-4 sm:px-5 sm:py-6 lg:px-6">
          {error && (
            <div className="workspace-banner-enter mb-4 rounded-xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-[13px] text-ink-dim">
              {error}
            </div>
          )}
          {/* Brand full-screen loading is only on AuthCallback (sign-in → workspace). */}
          {loading && !home ? (
            <div className="page-enter flex min-h-[50vh] flex-col items-center justify-center gap-3">
              <div
                className="h-6 w-6 rounded-full border-2 border-chronos/30 border-t-chronos animate-spin"
                aria-hidden
              />
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-faint">
                Opening workspace…
              </p>
            </div>
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

      {/* Mobile tab bar — public/mobile.png */}
      {ready && (
        <>
          {moreOpen && (
            <div
              className="fixed inset-0 z-40 bg-black/50 lg:hidden"
              role="presentation"
              onClick={() => setMoreOpen(false)}
            />
          )}
          {moreOpen && (
            <div
              className="workspace-drawer-enter fixed inset-x-0 bottom-[4.5rem] z-50 mx-auto max-w-lg px-3 lg:hidden"
              role="dialog"
              aria-label="More menu"
            >
              <div className="rounded-2xl border border-line bg-bg p-3 shadow-2xl">
                <div className="mb-2 px-2 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-faint">
                  Workspace
                </div>
                <div className="mb-3 rounded-xl border border-line bg-bg-soft/20 px-3 py-2.5">
                  <div className="font-chronos-wordmark text-lg text-ink">Chronos Lab</div>
                  <div className="text-xs text-ink-dim">
                    {home?.workspace.name ?? "Workspace"}
                  </div>
                </div>
                {moreMenuItems.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={() => setMoreOpen(false)}
                    className={({ isActive }) =>
                      `flex items-center gap-3 rounded-xl px-3 py-3 text-[15px] transition ${
                        isActive
                          ? "bg-chronos/15 text-chronos"
                          : "text-ink-dim hover:bg-bg-soft/40 hover:text-ink"
                      }`
                    }
                  >
                    <span className="w-5 text-center opacity-80">{item.icon}</span>
                    {item.label}
                  </NavLink>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    setMoreOpen(false);
                    void handleSignOut();
                  }}
                  className="mt-1 w-full rounded-xl border border-line px-3 py-3 text-left text-[15px] text-ink-dim"
                >
                  Sign out
                </button>
                <div className="mt-2 flex items-center gap-2 px-2 pt-2 border-t border-line">
                  <span className="inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400/80" />
                  <span className="font-mono text-[10px] uppercase text-ink-faint">
                    Sync status · local ready
                  </span>
                </div>
              </div>
            </div>
          )}

          <nav
            className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-bg/95 backdrop-blur-xl lg:hidden"
            aria-label="Workspace"
          >
            <div className="workspace-mobile-tabbar mx-auto max-w-lg">
              {mobilePrimary.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={"end" in item ? item.end : false}
                  aria-label={item.label}
                  className={({ isActive }) =>
                    `workspace-mobile-tab ${isActive ? "active" : ""}`
                  }
                >
                  <span className="workspace-mobile-tab-icon" aria-hidden>
                    {item.icon}
                  </span>
                  {item.label}
                </NavLink>
              ))}

              <NavLink
                to="/workspace/simulations?new=1"
                aria-label="Create new simulation"
                className="workspace-mobile-create"
              >
                +
              </NavLink>

              {mobileSecondary.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  aria-label={item.label}
                  className={({ isActive }) =>
                    `workspace-mobile-tab ${isActive ? "active" : ""}`
                  }
                >
                  <span className="workspace-mobile-tab-icon" aria-hidden>
                    {item.icon}
                  </span>
                  {item.label}
                </NavLink>
              ))}

              <button
                type="button"
                aria-label="More"
                aria-expanded={moreOpen}
                onClick={() => setMoreOpen((v) => !v)}
                className={`workspace-mobile-tab ${moreOpen ? "active" : ""}`}
              >
                <span className="workspace-mobile-tab-icon" aria-hidden>
                  ···
                </span>
                More
              </button>
            </div>
          </nav>
        </>
      )}
    </div>
  );
}
