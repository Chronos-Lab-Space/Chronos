const PREF_KEY = "chronos.notify.outcomeReview.enabled";
const LAST_NOTIFIED_KEY = "chronos.notify.outcomeReview.lastCount";

/**
 * Browser notifications for decisions due for review — opt-in, and honest
 * about what it actually is.
 *
 * There is no push infrastructure (see CLAUDE.md "Honest claims" and the
 * outcome-review-loop spec: "no email or push infrastructure"). This uses
 * the Notification API directly from the open tab — it can only fire while
 * Chronos is loaded in a browser, same as any other client-side effect. It
 * is not a substitute for a real push channel and must never be described
 * as one.
 */

export function isNotificationSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

export function notificationPermission(): NotificationPermission | "unsupported" {
  if (!isNotificationSupported()) return "unsupported";
  return Notification.permission;
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!isNotificationSupported()) return "denied";
  return Notification.requestPermission();
}

export function isOutcomeReviewNotifyEnabled(): boolean {
  if (typeof localStorage === "undefined") return false;
  return localStorage.getItem(PREF_KEY) === "1";
}

export function setOutcomeReviewNotifyEnabled(enabled: boolean): void {
  if (typeof localStorage === "undefined") return;
  if (enabled) localStorage.setItem(PREF_KEY, "1");
  else localStorage.removeItem(PREF_KEY);
}

function lastNotifiedCount(): number {
  if (typeof localStorage === "undefined") return 0;
  const raw = localStorage.getItem(LAST_NOTIFIED_KEY);
  const parsed = raw ? Number.parseInt(raw, 10) : 0;
  return Number.isFinite(parsed) ? parsed : 0;
}

function setLastNotifiedCount(count: number): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(LAST_NOTIFIED_KEY, String(count));
}

/**
 * Fires at most one notification per distinct due-count — a session that
 * re-renders the same due queue ten times must not fire ten notifications,
 * but a queue that grows (2 due -> 3 due) is news again.
 *
 * Returns whether it actually notified, so callers can test the decision
 * without a real `Notification` constructor.
 */
export function notifyIfDueCountChanged(dueCount: number): boolean {
  if (dueCount <= 0) {
    setLastNotifiedCount(0);
    return false;
  }
  if (!isOutcomeReviewNotifyEnabled()) return false;
  if (notificationPermission() !== "granted") return false;
  if (dueCount === lastNotifiedCount()) return false;

  setLastNotifiedCount(dueCount);
  new Notification("Chronos", {
    body:
      dueCount === 1
        ? "1 decision is due for review."
        : `${dueCount} decisions are due for review.`,
    tag: "chronos-outcome-review",
  });
  return true;
}
