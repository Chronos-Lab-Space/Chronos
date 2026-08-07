import { Link } from "react-router-dom";
import { useMemo, useState } from "react";
import {
  formatDurationMs,
  getProductAnalyticsSnapshot,
  trackProductEvent,
} from "../../../infrastructure/analytics/productAnalytics";
import {
  isNotificationSupported,
  isOutcomeReviewNotifyEnabled,
  notificationPermission,
  requestNotificationPermission,
  setOutcomeReviewNotifyEnabled,
} from "../../../infrastructure/notifications/outcomeReviewNotifier";
import { useWorkspace } from "./WorkspaceContext";
import { SurfaceLoading } from "./SurfaceLoading";
import { isAnonymousOwnerId } from "../../../domain/workspace/anonymousOwner";
import { deriveCalibration } from "../../../domain/workspace/calibration";
import { exportWorkspaceCsv, exportWorkspaceJson } from "../../../domain/workspace/dataExport";
import { AiUsagePanel } from "./components/AiUsagePanel";

/** Workspace settings — switch, create, inspect, share. */
export function WorkspaceSettingsPage() {
  const {
    home,
    ownerId,
    workspaces,
    createWorkspace,
    switchWorkspace,
    error,
    preferences,
    markShareAcknowledged,
  } = useWorkspace();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [shareNote, setShareNote] = useState<string | null>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies(home): re-read the local analytics snapshot whenever workspace data changes
  const analytics = useMemo(() => getProductAnalyticsSnapshot(), [home]);

  if (!home) return <SurfaceLoading eyebrow="Workspace" title="Workspaces" size="md" />;

  // Sharing and members need real identities, so this surface needs an account.
  // A sign-in prompt keeps an anonymous visitor inside the app; a redirect would
  // eject them from a workspace that otherwise works without one.
  if (isAnonymousOwnerId(ownerId)) {
    return (
      <div className="space-y-6">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-faint">
            Workspace
          </div>
          <h1 className="mt-2 font-serif text-3xl text-ink sm:text-4xl">Workspaces</h1>
        </div>
        <div
          data-testid="settings-requires-account"
          className="rounded-2xl border border-chronos/30 bg-chronos/5 px-5 py-6"
        >
          <p className="text-sm leading-relaxed text-ink-dim">
            Multiple workspaces and sharing need an account — they identify who a workspace belongs
            to. Your current decisions stay on this device until you sign in.
          </p>
          <Link
            to="/login"
            className="mt-4 inline-flex rounded-full border border-chronos/40 bg-chronos/10 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-chronos transition hover:bg-chronos/20"
          >
            Sign in to keep your decisions
          </Link>
        </div>
      </div>
    );
  }

  const onCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setLocalError(null);
    try {
      await createWorkspace(name.trim() || "New workspace", description.trim());
      setName("");
      setDescription("");
    } catch (err) {
      setLocalError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const onSwitch = async (id: string) => {
    if (id === home.workspace.id) return;
    setBusy(true);
    setLocalError(null);
    try {
      await switchWorkspace(id);
    } catch (err) {
      setLocalError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="ws-cascade space-y-10">
      <div className="header-enter">
        <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-faint">
          Settings
        </div>
        <h1 className="mt-2 font-serif text-3xl text-ink sm:text-4xl">Workspaces</h1>
        <p className="mt-2 text-sm text-ink-dim">
          Create a new HQ anytime. Switch without losing history — each workspace keeps its own
          goals, knowledge, and simulations.
        </p>
      </div>

      {/* Active */}
      <section className="border border-line p-4 transition duration-200 hover:border-line-strong sm:p-5">
        <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-chronos">Active</div>
        <dl className="mt-4 space-y-3">
          <Row label="Name" value={home.workspace.name} />
          <Row label="Description" value={home.workspace.description || "—"} />
          <Row label="Goal" value={home.goal?.title ?? "—"} />
          <Row label="Simulations" value={String(home.recentSimulations.length)} />
          <Row label="Knowledge" value={String(home.knowledge.length)} />
        </dl>
      </section>

      {/* Switch */}
      <section>
        <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-faint">
          Your workspaces ({workspaces.length})
        </div>
        <ul className="mt-3 divide-y divide-line border-y border-line">
          {workspaces.map((ws) => {
            const active = ws.id === home.workspace.id;
            return (
              <li
                key={ws.id}
                className="flex items-center justify-between gap-3 py-3 transition-colors duration-200 hover:bg-chronos/5"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm text-ink">
                    {ws.name}
                    {active && (
                      <span className="ml-2 font-mono text-[10px] uppercase text-chronos">
                        active
                      </span>
                    )}
                  </div>
                  {ws.description ? (
                    <div className="truncate text-xs text-ink-dim">{ws.description}</div>
                  ) : null}
                </div>
                {!active && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void onSwitch(ws.id)}
                    className="shrink-0 rounded-full border border-line px-3 py-1.5 text-xs text-ink transition hover:border-chronos/50 hover:text-chronos disabled:opacity-50"
                  >
                    Switch
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      {/* Share workspace (beta checklist) */}
      <section className="border border-line p-4 sm:p-5">
        <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-chronos">
          Share workspace
        </div>
        <p className="mt-2 text-sm text-ink-dim">
          Membership is ready for multi-user workspaces. For this beta, copy a share note for
          teammates — full invites land next.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={async () => {
              const text = `Join my Chronos workspace “${home.workspace.name}” — sign in at ${typeof window !== "undefined" ? window.location.origin : "https://chronoslab.space"}/login?intent=start`;
              try {
                await navigator.clipboard.writeText(text);
                setShareNote("Share text copied.");
              } catch {
                setShareNote(text);
              }
              markShareAcknowledged();
            }}
            className="rounded-full bg-ink px-4 py-2 text-sm text-bg hover:bg-chronos"
          >
            {preferences.shareAcknowledged ? "Copy share text again" : "Copy share text"}
          </button>
        </div>
        {shareNote && <p className="mt-3 text-sm text-chronos">{shareNote}</p>}
      </section>

      {/* Create new */}
      <section className="workspace-panel-enter border border-line p-4 sm:p-5">
        <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-chronos">
          Create new workspace
        </div>
        <form onSubmit={onCreate} className="mt-4 space-y-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Workspace name"
            required
            className="w-full rounded-lg border border-line bg-bg px-3 py-2.5 text-sm text-ink focus:border-chronos focus:outline-none"
          />
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Short description (optional)"
            className="w-full rounded-lg border border-line bg-bg px-3 py-2.5 text-sm text-ink focus:border-chronos focus:outline-none"
          />
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-full bg-ink px-4 py-2.5 text-sm font-medium text-bg transition hover:bg-chronos disabled:opacity-50 sm:w-auto"
          >
            {busy ? "Creating…" : "Create workspace"}
          </button>
        </form>
        {(localError || error) && (
          <p className="mt-3 text-sm text-red-400">{localError || error}</p>
        )}
      </section>

      <AiUsagePanel />

      {/* Export data */}
      <section className="border border-line p-4 sm:p-5">
        <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-chronos">
          Export data
        </div>
        <p className="mt-2 text-sm text-ink-dim">
          Every decision, its versions, and the calibration read on them — as JSON for a full
          record, or CSV for a spreadsheet.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              const json = exportWorkspaceJson(home, deriveCalibration(home));
              downloadFile(json, `${home.workspace.id}-decisions.json`, "application/json");
              trackProductEvent("report_exported", { format: "json", scope: "workspace" });
            }}
            className="rounded-full border border-line px-4 py-2 text-sm text-ink transition hover:border-chronos/50 hover:text-chronos"
          >
            Download JSON
          </button>
          <button
            type="button"
            onClick={() => {
              const csv = exportWorkspaceCsv(home);
              downloadFile(csv, `${home.workspace.id}-decisions.csv`, "text/csv");
              trackProductEvent("report_exported", { format: "csv", scope: "workspace" });
            }}
            className="rounded-full border border-line px-4 py-2 text-sm text-ink transition hover:border-chronos/50 hover:text-chronos"
          >
            Download CSV
          </button>
        </div>
      </section>

      <NotificationToggle />

      {/* Local product analytics (beta instrumentation) */}
      <section className="border border-line p-4 sm:p-5">
        <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-chronos">
          Product analytics (this browser)
        </div>
        <p className="mt-2 text-sm text-ink-dim">
          Funnel counters for beta learning — workspace creation, simulations, time to first
          decision, exports, and return visits. Never blocks the product.
        </p>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2">
          <Row label="Workspaces created" value={String(analytics.workspace_created)} />
          <Row label="Simulations started" value={String(analytics.simulation_started)} />
          <Row label="Simulations completed" value={String(analytics.simulation_completed)} />
          <Row label="Paths chosen" value={String(analytics.path_chosen)} />
          <Row label="Reports exported" value={String(analytics.report_exported)} />
          <Row label="Sessions (days)" value={String(analytics.sessions)} />
          <Row label="Active days" value={String(analytics.retention_days)} />
          <Row
            label="Time to first decision"
            value={formatDurationMs(analytics.time_to_first_decision_ms)}
          />
        </dl>
      </section>
    </div>
  );
}

function downloadFile(content: string, filename: string, mimeType: string): void {
  if (typeof document === "undefined") return;
  const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/**
 * Opt-in browser notification for decisions due for review.
 *
 * Deliberately not called "reminders" or "push" in the copy — there is no
 * push infrastructure. This can only fire while Chronos is open in a tab;
 * see outcomeReviewNotifier.ts.
 */
function NotificationToggle() {
  const [enabled, setEnabled] = useState(() => isOutcomeReviewNotifyEnabled());
  const [permission, setPermission] = useState(() => notificationPermission());

  if (!isNotificationSupported()) return null;

  const onToggle = async () => {
    if (enabled) {
      setOutcomeReviewNotifyEnabled(false);
      setEnabled(false);
      return;
    }
    const granted = await requestNotificationPermission();
    setPermission(granted);
    if (granted === "granted") {
      setOutcomeReviewNotifyEnabled(true);
      setEnabled(true);
    }
  };

  return (
    <section className="border border-line p-4 sm:p-5">
      <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-chronos">
        Browser notifications
      </div>
      <p className="mt-2 text-sm text-ink-dim">
        A notification from this tab when a decision is due for review — only while Chronos is open
        in your browser. There is no email or push beyond that.
      </p>
      <button
        type="button"
        onClick={() => void onToggle()}
        disabled={permission === "denied"}
        className="mt-4 rounded-full border border-line px-4 py-2 text-sm text-ink transition hover:border-chronos/50 hover:text-chronos disabled:opacity-50"
      >
        {enabled ? "Turn off" : "Notify me when a review is due"}
      </button>
      {permission === "denied" && (
        <p className="mt-3 text-xs text-ink-faint">
          Notifications are blocked for this site in your browser settings.
        </p>
      )}
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <dt className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint">{label}</dt>
      <dd className="max-w-[70%] break-all text-right text-sm text-ink">{value}</dd>
    </div>
  );
}
