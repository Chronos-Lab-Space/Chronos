/**
 * Product analytics for Chronos beta instrumentation.
 *
 * Dual-write: local counters (always) + Supabase events table (best-effort).
 * Analytics must never throw or block UX.
 *
 * Funnel metrics:
 * - workspace creation rate
 * - simulations started / completed
 * - average time to first decision
 * - repeat usage (active days)
 * - exported reports
 * - user retention signals
 */
import { analyticsQueries } from "../queries/SupabaseAnalyticsQueries";

const STORAGE_KEY = "chronos.product.analytics.v1";

export type ProductEventName =
  | "session_start"
  | "workspace_created"
  | "goal_set"
  | "knowledge_added"
  | "simulation_started"
  | "simulation_completed"
  | "path_chosen"
  | "report_exported"
  | "outcome_followed"
  | "outcome_result"
  | "workspace_opened";

export type ProductAnalyticsSnapshot = {
  workspace_created: number;
  simulation_started: number;
  simulation_completed: number;
  path_chosen: number;
  report_exported: number;
  sessions: number;
  knowledge_added: number;
  /** ISO timestamps */
  first_workspace_at: string | null;
  first_decision_at: string | null;
  last_active_at: string | null;
  /** Unique YYYY-MM-DD days with any event — retention proxy */
  active_days: string[];
  /** Milliseconds workspace → first path chosen (null until first decision) */
  time_to_first_decision_ms: number | null;
  /** Distinct active days count */
  retention_days: number;
};

type StoreShape = {
  workspace_created: number;
  simulation_started: number;
  simulation_completed: number;
  path_chosen: number;
  report_exported: number;
  sessions: number;
  knowledge_added: number;
  first_workspace_at: string | null;
  first_decision_at: string | null;
  last_active_at: string | null;
  active_days: string[];
  /** last session day to avoid double-counting session_start same day */
  last_session_day: string | null;
};

function emptyStore(): StoreShape {
  return {
    workspace_created: 0,
    simulation_started: 0,
    simulation_completed: 0,
    path_chosen: 0,
    report_exported: 0,
    sessions: 0,
    knowledge_added: 0,
    first_workspace_at: null,
    first_decision_at: null,
    last_active_at: null,
    active_days: [],
    last_session_day: null,
  };
}

function dayKey(iso: string = new Date().toISOString()): string {
  return iso.slice(0, 10);
}

function readStore(): StoreShape {
  if (typeof localStorage === "undefined") return emptyStore();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyStore();
    const parsed = JSON.parse(raw) as Partial<StoreShape>;
    return { ...emptyStore(), ...parsed, active_days: parsed.active_days ?? [] };
  } catch {
    return emptyStore();
  }
}

function writeStore(store: StoreShape): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    /* quota / private mode */
  }
}

function bumpActiveDay(store: StoreShape, nowIso: string): void {
  const day = dayKey(nowIso);
  if (!store.active_days.includes(day)) {
    store.active_days = [...store.active_days, day].slice(-90);
  }
  store.last_active_at = nowIso;
}

/**
 * Track a product event. Never throws.
 */
export function trackProductEvent(
  event: ProductEventName,
  properties: Record<string, unknown> = {}
): void {
  try {
    const nowIso = new Date().toISOString();
    const store = readStore();
    bumpActiveDay(store, nowIso);

    switch (event) {
      case "session_start": {
        const day = dayKey(nowIso);
        if (store.last_session_day !== day) {
          store.sessions += 1;
          store.last_session_day = day;
        }
        break;
      }
      case "workspace_created":
        store.workspace_created += 1;
        if (!store.first_workspace_at) store.first_workspace_at = nowIso;
        break;
      case "simulation_started":
        store.simulation_started += 1;
        break;
      case "simulation_completed":
        store.simulation_completed += 1;
        break;
      case "path_chosen":
        store.path_chosen += 1;
        if (!store.first_decision_at) store.first_decision_at = nowIso;
        break;
      case "report_exported":
        store.report_exported += 1;
        break;
      case "knowledge_added":
        store.knowledge_added += 1;
        break;
      default:
        break;
    }

    writeStore(store);

    void analyticsQueries.track({
      event: `product.${event}`,
      properties: {
        ...properties,
        ts: nowIso,
        counters: {
          workspace_created: store.workspace_created,
          simulation_started: store.simulation_started,
          simulation_completed: store.simulation_completed,
          path_chosen: store.path_chosen,
          report_exported: store.report_exported,
          sessions: store.sessions,
        },
      },
    });
  } catch (err) {
    console.warn("[chronos] product analytics failed:", err);
  }
}

/** Local funnel snapshot for settings / debugging / internal dashboards. */
export function getProductAnalyticsSnapshot(): ProductAnalyticsSnapshot {
  const store = readStore();
  let time_to_first_decision_ms: number | null = null;
  if (store.first_workspace_at && store.first_decision_at) {
    const a = Date.parse(store.first_workspace_at);
    const b = Date.parse(store.first_decision_at);
    if (!Number.isNaN(a) && !Number.isNaN(b) && b >= a) {
      time_to_first_decision_ms = b - a;
    }
  }

  return {
    workspace_created: store.workspace_created,
    simulation_started: store.simulation_started,
    simulation_completed: store.simulation_completed,
    path_chosen: store.path_chosen,
    report_exported: store.report_exported,
    sessions: store.sessions,
    knowledge_added: store.knowledge_added,
    first_workspace_at: store.first_workspace_at,
    first_decision_at: store.first_decision_at,
    last_active_at: store.last_active_at,
    active_days: store.active_days,
    time_to_first_decision_ms,
    retention_days: store.active_days.length,
  };
}

/** Human-readable duration for time-to-first-decision. */
export function formatDurationMs(ms: number | null): string {
  if (ms == null || ms < 0) return "—";
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`;
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)}m`;
  if (ms < 86_400_000) return `${(ms / 3_600_000).toFixed(1)}h`;
  return `${(ms / 86_400_000).toFixed(1)}d`;
}
