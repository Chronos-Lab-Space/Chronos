/**
 * Error monitoring scaffold for public beta.
 *
 * - Always safe: never throws, never blocks UX
 * - When VITE_SENTRY_DSN is set, lazily loads @sentry/react
 * - Without DSN: console.error only (dev visibility)
 *
 * Install: npm i @sentry/react
 * Configure: VITE_SENTRY_DSN=https://...@o....ingest.sentry.io/...
 */

type Severity = "fatal" | "error" | "warning" | "info";

type CaptureContext = {
  tags?: Record<string, string>;
  extra?: Record<string, unknown>;
  level?: Severity;
};

type SentryLike = {
  init: (opts: Record<string, unknown>) => void;
  captureException: (error: unknown, context?: Record<string, unknown>) => void;
  captureMessage: (message: string, context?: Record<string, unknown>) => void;
};

let sentry: SentryLike | null = null;
let initAttempted = false;

function readDsn(): string | undefined {
  try {
    const dsn = import.meta.env.VITE_SENTRY_DSN;
    return typeof dsn === "string" && dsn.trim() ? dsn.trim() : undefined;
  } catch {
    return undefined;
  }
}

/** Call once at app boot (main.tsx). */
export async function initErrorMonitoring(): Promise<void> {
  if (initAttempted) return;
  initAttempted = true;

  const dsn = readDsn();
  if (!dsn) {
    if (import.meta.env.DEV) {
      console.info("[chronos] error monitoring: no VITE_SENTRY_DSN — console only");
    }
    return;
  }

  try {
    const mod = await import("@sentry/react");
    mod.init({
      dsn,
      environment: import.meta.env.MODE,
      // Low sample rate for beta noise control; raise after launch ops stabilizes
      tracesSampleRate: 0.1,
      sendDefaultPii: false,
    });
    sentry = {
      init: mod.init,
      captureException: mod.captureException,
      captureMessage: mod.captureMessage,
    };
  } catch (err) {
    console.warn(
      "[chronos] Sentry init failed (is @sentry/react installed?). Falling back to console.",
      err
    );
  }
}

export function captureException(
  error: unknown,
  context: CaptureContext = {}
): void {
  try {
    console.error("[chronos]", error, context.extra ?? "");
    if (!sentry) return;
    sentry.captureException(error, {
      level: context.level ?? "error",
      tags: context.tags,
      extra: context.extra,
    });
  } catch {
    /* never throw from monitoring */
  }
}

export function captureMessage(
  message: string,
  context: CaptureContext = {}
): void {
  try {
    if (import.meta.env.DEV || !sentry) {
      console[context.level === "warning" ? "warn" : "error"]("[chronos]", message);
    }
    if (!sentry) return;
    sentry.captureMessage(message, {
      level: context.level ?? "info",
      tags: context.tags,
      extra: context.extra,
    });
  } catch {
    /* never throw from monitoring */
  }
}

export function isErrorMonitoringEnabled(): boolean {
  return Boolean(sentry);
}
