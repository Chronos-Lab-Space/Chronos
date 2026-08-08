import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { deriveDecisionBrief } from "../../../domain/workspace/decisionBrief";
import { showsEntrySurface } from "../../../domain/workspace/onboarding";
import { authService } from "../../../infrastructure/auth/SupabaseAuthService";
import { ChronosCMark } from "../../components/ChronosCMark";
import { WorkspaceCommandPalette } from "./WorkspaceCommandPalette";
import { WorkspaceContextRail } from "./WorkspaceContextRail";
import { WorkspaceProvider, useWorkspace } from "./WorkspaceContext";
import { WorkspaceStageBand } from "./WorkspaceStageBand";
import { WorkspaceStart } from "./WorkspaceStart";
import { isAnonymousOwnerId } from "../../../domain/workspace/anonymousOwner";

type NavItem = { to: string; label: string; short: string; end?: boolean; icon: string };

/**
 * Desktop sidebar — the imported workspace design splits nav into the decision
 * loop itself and the surfaces around it. The design's `Reports` item is
 * omitted: nothing routes there, and a dead nav item reads as a broken product.
 */
const navItems: NavItem[] = [
  { to: "/workspace", label: "Current Decision", short: "Home", end: true, icon: "⌂" },
  { to: "/workspace/decisions", label: "Decisions", short: "Decs", icon: "◈" },
  { to: "/workspace/knowledge", label: "Knowledge", short: "Know", icon: "☰" },
  { to: "/workspace/simulations", label: "Simulations", short: "Sims", icon: "⬡" },
  { to: "/workspace/timeline", label: "Timeline", short: "Time", icon: "▤" },
  { to: "/workspace/memory", label: "Memory", short: "Mem", icon: "▣" },
];

/** Below the divider in the design — supporting surfaces, not the loop. */
const secondaryNavItems: NavItem[] = [
  { to: "/workspace/hq", label: "Workspace HQ", short: "HQ", icon: "▦" },
  { to: "/workspace/settings", label: "Settings", short: "Set", icon: "⚙" },
];

/** 24-hour clock for the header's sync stamp, matching the design's `SYNCED 10:42`. */
function formatSyncTime(at: Date): string {
  return at.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });
}

/**
 * The design's `Window · 17 days left`. A decision only has a window once a path
 * is saved with a review horizon, so this is null until then — the row is hidden
 * rather than showing an invented deadline.
 */
function reviewWindowLabel(reviewAt: string | null | undefined, now: Date): string | null {
  if (!reviewAt) return null;
  const due = new Date(reviewAt).getTime();
  if (Number.isNaN(due)) return null;

  const days = Math.ceil((due - now.getTime()) / 86_400_000);
  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days === 0) return "due today";
  return `${days} day${days === 1 ? "" : "s"} left`;
}

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
  const { home, loading, ownerId, error, remoteError, notice, dismissNotice, entrySubmitting } =
    useWorkspace();
  const [moreOpen, setMoreOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  // The design's `SYNCED 10:42`. Nothing in the workspace record stores a sync
  // time, so this is when data last actually landed — blank until it does,
  // rather than claiming a sync that never happened.
  const [syncedAt, setSyncedAt] = useState<Date | null>(null);

  // Not `isWorkspaceOnboarded` directly: the entry screen saves the goal
  // before its run finishes, and swapping on that alone unmounted it mid-submit.
  const ready = !showsEntrySurface(home, entrySubmitting);
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
  // Questions, not runs — three re-runs of one question count once here and
  // three times under Simulations. That gap is the point of the surface.
  const decisionsCount = home ? home.decisions.length : null;
  const navCounts: Record<string, number | null> = {
    "/workspace/decisions": decisionsCount,
    "/workspace/knowledge": sourcesCount,
    "/workspace/simulations": simsCount,
    "/workspace/memory": memoryCount,
  };

  const reviewWindow = reviewWindowLabel(
    brief?.reportSimulation?.result.review_at,
    syncedAt ?? new Date()
  );

  useEffect(() => {
    if (!loading && home && !remoteError) setSyncedAt(new Date());
  }, [loading, home, remoteError]);

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
    // Desktop is an app shell with its own scroll regions, per the design: the
    // header and stage band stay put while content and rail scroll
    // independently. Below `lg` the page scrolls normally under the tab bar.
    <div className="workspace-shell-enter flex min-h-dvh flex-col bg-bg pb-[5.25rem] lg:h-dvh lg:min-h-0 lg:overflow-hidden lg:pb-0">
      {/* Top bar */}
      <header className="sticky top-0 z-40 shrink-0 border-b border-line bg-bg/95 backdrop-blur-xl lg:static">
        <div className="flex h-14 items-center gap-3 px-3 sm:px-4 lg:h-[62px] lg:gap-8 lg:px-6">
          <div className="flex min-w-0 items-center gap-2.5 lg:w-[236px] lg:shrink-0">
            <ChronosCMark size={22} className="chronos-brand-mark shrink-0 text-ink" />
            <div className="min-w-0">
              <div className="flex items-baseline gap-1.5">
                <span className="font-chronos-wordmark text-[18px] leading-none text-ink sm:text-[20px] lg:text-[24px] lg:font-semibold">
                  Chronos
                </span>
                <span className="hidden font-mono text-[9px] uppercase tracking-[0.18em] text-accent-2 sm:inline">
                  Lab
                </span>
              </div>
            </div>
          </div>

          {ready && (
            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              className="mx-auto hidden min-w-0 max-w-xl flex-1 cursor-text items-center gap-3 rounded-full border border-line-strong bg-bg-soft/25 py-2 pl-3 pr-4 text-left text-sm text-ink-faint transition hover:border-ink-faint md:flex lg:h-[34px] lg:max-w-[520px] lg:py-0"
            >
              <span className="shrink-0 font-mono text-[10px] tracking-[0.06em]">⌘K</span>
              <span className="truncate lg:text-[13px]">Search, ask, or run a command…</span>
            </button>
          )}

          <div className="ml-auto flex shrink-0 items-center gap-2 lg:gap-3.5">
            {ready && syncedAt && (
              <span className="hidden font-mono text-[10px] uppercase tracking-[0.14em] text-ink-faint lg:inline">
                Synced {formatSyncTime(syncedAt)}
              </span>
            )}
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
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-line-strong bg-chronos/15 font-mono text-[10px] text-accent-2 lg:h-[27px] lg:w-[27px]"
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
          className="flex shrink-0 items-center justify-center gap-3 border-b border-chronos/25 bg-chronos/10 px-4 py-2 text-center text-[13px] text-ink-dim"
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
          className="shrink-0 border-b border-chronos/25 bg-chronos/5 px-4 py-2 text-center text-[13px] text-ink-dim"
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
          className="shrink-0 border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-center text-[13px] text-amber-100/90"
        >
          Cloud sync failed — decisions are saved on this device.{" "}
          <span className="font-mono text-[11px] text-ink-faint">
            {remoteError.length > 120 ? `${remoteError.slice(0, 120)}…` : remoteError}
          </span>
        </div>
      )}

      <div className="flex flex-1 lg:min-h-0">
        {/* Desktop left nav */}
        {ready && (
          <aside className="hidden w-[236px] shrink-0 border-r border-line lg:flex lg:flex-col lg:overflow-y-auto">
            <nav className="flex h-full flex-col gap-[3px] px-3.5 py-[22px]" aria-label="Workspace">
              <div className="px-2.5 pb-3 font-mono text-[9.5px] uppercase tracking-[0.2em] text-ink-faint/75">
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
                      `workspace-nav-active flex items-center justify-between rounded-lg px-[11px] py-[9px] text-[13.5px] transition ${
                        isActive
                          ? "bg-chronos/15 text-ink"
                          : "text-ink-faint hover:bg-bg-soft/28 hover:text-ink"
                      }`
                    }
                  >
                    <span>{item.label}</span>
                    {item.to === "/workspace" ? (
                      <span
                        className="chpulse h-[5px] w-[5px] rounded-full bg-chronos"
                        aria-hidden
                      />
                    ) : count != null && count > 0 ? (
                      <span className="font-mono text-[10px] text-ink-faint/75">{count}</span>
                    ) : null}
                  </NavLink>
                );
              })}

              <div className="mx-2.5 my-4 h-px bg-line" />

              {secondaryNavItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `workspace-nav-active rounded-lg px-[11px] py-[9px] text-[13.5px] transition ${
                      isActive
                        ? "bg-chronos/15 text-ink"
                        : "text-ink-faint hover:bg-bg-soft/28 hover:text-ink"
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              ))}

              <div className="mt-auto">
                <div
                  className="rounded-xl border border-line bg-bg-soft/16 p-3.5"
                  data-testid="sidebar-active-decision"
                >
                  <div className="mb-2.5 font-mono text-[9px] uppercase tracking-[0.18em] text-ink-faint/75">
                    Active decision
                  </div>
                  <div className="mb-3.5 line-clamp-2 font-serif text-[18px] leading-[1.25] text-ink">
                    {home?.goal?.title ?? "No goal yet"}
                  </div>
                  <div className="flex flex-col gap-[7px] text-[12px]">
                    <div className="flex justify-between">
                      <span className="text-ink-faint">State</span>
                      <span className="text-chronos">
                        {brief?.stages.find((s) => s.state === "current")?.label ?? "Planning"}
                      </span>
                    </div>
                    {/* The card names the decision; without its confidence it
                        says nothing about where the decision actually stands. */}
                    {brief?.confidencePct != null && (
                      <div className="flex justify-between">
                        <span className="text-ink-faint">Confidence</span>
                        <span className="tabular-nums">{brief.confidencePct}%</span>
                      </div>
                    )}
                    {reviewWindow && (
                      <div className="flex justify-between">
                        <span className="text-ink-faint">Window</span>
                        <span className="tabular-nums">{reviewWindow}</span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2.5 px-2.5 pb-0.5 pt-4">
                  <ChronosCMark size={16} className="shrink-0 text-ink-faint opacity-85" />
                  <div>
                    <div className="text-[11px] text-accent-2">Chronos Lab</div>
                    <div className="font-mono text-[9px] tracking-[0.04em] text-ink-faint">
                      Decision infrastructure
                    </div>
                  </div>
                </div>
              </div>
            </nav>
          </aside>
        )}

        <main className="flex min-w-0 flex-1 flex-col">
          {error && (
            <div className="workspace-banner-enter mx-3 mt-4 rounded-xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-[13px] text-ink-dim sm:mx-5 lg:mx-14">
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
            <div key="entry" className="page-enter px-3 py-4 sm:px-5 sm:py-6 lg:px-14">
              <WorkspaceStart />
              {loading ? (
                <p className="mt-4 text-center font-mono text-[10px] uppercase text-ink-faint">
                  Syncing…
                </p>
              ) : null}
            </div>
          ) : (
            <>
              {/* The band spans content and rail together, per the design. */}
              {brief && <WorkspaceStageBand stages={brief.stages} />}
              <div className="flex flex-1 lg:min-h-0">
                <div
                  key={routeKey}
                  className="page-enter min-w-0 flex-1 overflow-x-hidden px-3 py-4 sm:px-5 sm:py-6 lg:overflow-y-auto lg:px-14 lg:pb-16 lg:pt-[42px]"
                >
                  {loading ? (
                    <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint">
                      Syncing workspace…
                    </p>
                  ) : null}
                  <Outlet />
                </div>

                {showContextRail && home ? (
                  <WorkspaceContextRail home={home} activeSimulationId={activeSimulationId} />
                ) : null}
              </div>
            </>
          )}
        </main>
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
