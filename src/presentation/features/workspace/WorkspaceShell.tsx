import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { deriveDecisionBrief } from "../../../domain/workspace/decisionBrief";
import { isWorkspaceOnboarded } from "../../../domain/workspace/onboarding";
import { authService } from "../../../infrastructure/auth/SupabaseAuthService";
import { ChronosCMark } from "../../components/ChronosCMark";
import { WorkspaceCommandPalette } from "./WorkspaceCommandPalette";
import { WorkspaceContextRail } from "./WorkspaceContextRail";
import { WorkspaceProvider, useWorkspace } from "./WorkspaceContext";
import { WorkspaceOnboarding } from "./WorkspaceOnboarding";
import { WorkspaceStageBand } from "./WorkspaceStageBand";
import { isAnonymousOwnerId } from "../../../domain/workspace/anonymousOwner";

type NavItem = { to: string; label: string; short: string; end?: boolean; icon: string };

/** Desktop sidebar — matches docs/images/workspace-desktop-mock.png */
const navItems: NavItem[] = [
  { to: "/workspace", label: "Current Decision", short: "Home", end: true, icon: "⌂" },
  { to: "/workspace/hq", label: "Workspace HQ", short: "HQ", icon: "▦" },
  { to: "/workspace/knowledge", label: "Knowledge", short: "Know", icon: "☰" },
  { to: "/workspace/simulations", label: "Simulations", short: "Sims", icon: "⬡" },
  { to: "/workspace/timeline", label: "Timeline", short: "Time", icon: "▤" },
  { to: "/workspace/memory", label: "Memory", short: "Mem", icon: "▣" },
  { to: "/workspace/settings", label: "Settings", short: "Set", icon: "⚙" },
];

/** Mobile tab bar — matches docs/images/workspace-mobile-mock.png: Home · Sims · + · Timeline · More */
const mobilePrimary = [
  { to: "/workspace", label: "Home", end: true, icon: "⌂" },
  { to: "/workspace/simulations", label: "Simulations", icon: "⬡" },
] as const;

const mobileSecondary = [{ to: "/workspace/timeline", label: "Timeline", icon: "▤" }] as const;

const moreMenuItems: NavItem[] = [
  { to: "/workspace/hq", label: "Workspace HQ", short: "HQ", icon: "▦" },
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
  const { home, loading, ownerId, error, remoteError, notice, dismissNotice } = useWorkspace();
  const [moreOpen, setMoreOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  const ready = isWorkspaceOnboarded(home);
  const initials = (ownerId ?? "You").slice(0, 2).toUpperCase();
  const anonymous = isAnonymousOwnerId(ownerId);
  const routeKey = location.pathname;
  const brief = deriveDecisionBrief(home);
  // Simulation detail is where a decision is actually worked — compare futures,
  // collapse, log the outcome — so it is the surface the rail's "don't navigate
  // away for context" argument is really about.
  const activeSimulationId =
    location.pathname.match(/^\/workspace\/simulations\/([^/]+)$/)?.[1] ?? undefined;
  const showContextRail =
    ready &&
    (location.pathname === "/workspace" ||
      location.pathname === "/workspace/" ||
      location.pathname === "/workspace/hq" ||
      Boolean(activeSimulationId));

  // Live counts for the sidebar — same numbers the pages report.
  const sourcesCount = home ? home.knowledge.length + home.notes.length : null;
  const simsCount = home ? home.recentSimulations.length : null;
  const memoryCount = home
    ? home.recentSimulations.filter((s) => Boolean(s.result.outcome_result?.toString().trim()))
        .length
    : null;
  const navCounts: Record<string, number | null> = {
    "/workspace/knowledge": sourcesCount,
    "/workspace/simulations": simsCount,
    "/workspace/memory": memoryCount,
  };

  const handleSignOut = async () => {
    await authService.signOut();
    navigate("/login", { replace: true });
  };

  // ⌘K / Ctrl+K opens the command palette anywhere in the workspace.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((open) => !open);
      } else if (e.key === "Escape") {
        setPaletteOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

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
            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              className="mx-auto hidden min-w-0 flex-1 max-w-xl cursor-text items-center gap-3 rounded-full border border-line bg-bg-soft/25 py-2 pl-3 pr-4 text-left text-sm text-ink-faint transition hover:border-chronos/50 md:flex"
            >
              <span className="shrink-0 font-mono text-[10px]">⌘K</span>
              <span className="truncate">Search, ask, or run a command…</span>
            </button>
          )}

          <div className="ml-auto flex shrink-0 items-center gap-2">
            {ready && (
              <button
                type="button"
                onClick={() => setPaletteOpen(true)}
                aria-label="Open command palette"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-line text-ink-dim transition hover:border-chronos/40 hover:text-ink md:hidden"
              >
                <span aria-hidden className="text-[15px] leading-none">
                  ⌕
                </span>
              </button>
            )}
            {anonymous ? (
              <Link
                to="/login"
                data-testid="sign-in-to-save"
                className="rounded-full border border-chronos/40 bg-chronos/10 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-chronos transition hover:bg-chronos/20"
              >
                Sign in to save
              </Link>
            ) : (
              <>
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
              </>
            )}
          </div>
        </div>
      </header>

      {notice && (
        <div
          role="status"
          data-testid="workspace-notice"
          className="flex items-center justify-center gap-3 border-b border-chronos/25 bg-chronos/10 px-4 py-2 text-center text-[13px] text-ink-dim"
        >
          <span>{notice}</span>
          <button
            type="button"
            onClick={dismissNotice}
            className="rounded-full border border-line px-2 py-0.5 font-mono text-[10px] uppercase text-ink-faint transition hover:text-ink"
          >
            Dismiss
          </button>
        </div>
      )}

      {anonymous && (
        <div
          role="status"
          data-testid="anonymous-banner"
          className="border-b border-chronos/25 bg-chronos/5 px-4 py-2 text-center text-[13px] text-ink-dim"
        >
          Saved on this device only — clearing your browser data loses it.{" "}
          <Link to="/login" className="text-chronos underline-offset-2 hover:underline">
            Sign in to keep your decisions
          </Link>
        </div>
      )}

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
              {navItems.map((item) => {
                const count = navCounts[item.to];
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) =>
                      `workspace-nav-active flex items-center justify-between rounded-lg px-3 py-2.5 text-[13px] transition ${
                        isActive
                          ? "bg-chronos/15 font-medium text-chronos"
                          : "text-ink-dim hover:bg-bg-soft/30 hover:text-ink"
                      }`
                    }
                  >
                    <span>{item.label}</span>
                    {item.to === "/workspace" ? (
                      <span className="blink h-[5px] w-[5px] rounded-full bg-chronos" aria-hidden />
                    ) : count != null && count > 0 ? (
                      <span className="font-mono text-[10px] text-ink-faint">{count}</span>
                    ) : null}
                  </NavLink>
                );
              })}

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
            <>
              {brief && <WorkspaceStageBand stages={brief.stages} />}
              <div key={routeKey} className="page-enter">
                {loading ? (
                  <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint">
                    Syncing workspace…
                  </p>
                ) : null}
                <Outlet />
              </div>
            </>
          )}
        </main>

        {showContextRail && home ? (
          <WorkspaceContextRail home={home} activeSimulationId={activeSimulationId} />
        ) : null}
      </div>

      {paletteOpen && ready ? (
        <WorkspaceCommandPalette home={home} onClose={() => setPaletteOpen(false)} />
      ) : null}

      {/* Mobile tab bar — docs/images/workspace-mobile-mock.png */}
      {ready && (
        <>
          {moreOpen && (
            // biome-ignore lint/a11y/noStaticElementInteractions: backdrop click-to-dismiss; the More toggle and drawer buttons stay keyboard-reachable
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
                  <div className="text-xs text-ink-dim">{home?.workspace.name ?? "Workspace"}</div>
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
                  className={({ isActive }) => `workspace-mobile-tab ${isActive ? "active" : ""}`}
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
                  className={({ isActive }) => `workspace-mobile-tab ${isActive ? "active" : ""}`}
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
