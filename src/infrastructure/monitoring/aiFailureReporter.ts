/**
 * Makes AI proxy failures visible.
 *
 * Recommendation enrichment fails open by design: if the proxy is down,
 * misconfigured, or out of quota, the user still gets a recommendation —
 * the deterministic one. That is the right product behaviour and a bad
 * operational one, because a broken proxy produces no complaints, no
 * errors, and no `ai_usage` rows. Nothing distinguishes it from a quiet
 * week. So the adapter reports, and this decides how loudly.
 */

import type { ProxyFailure } from "../ai/ProxyAIProvider";
import { captureException, captureMessage } from "./errorMonitoring";

type Severity = "error" | "warning" | "info";

/**
 * Deliberate states are quiet; broken ones are not.
 *
 * 503 is the global kill switch or a deployment with no upstream secrets —
 * someone chose that. 429 is a cap doing its job, which is worth watching
 * for a trend but is not a fault. Everything else means the path is broken
 * in a way nobody asked for, including a 401: the adapter only reaches the
 * network holding a token, so a rejected one is a real problem.
 */
export function severityForAIFailure(failure: ProxyFailure): Severity {
  if (failure.stage === "config") return "warning";
  if (failure.stage === "network") return "error";
  if (failure.status === 503) return "info";
  if (failure.status === 429) return "warning";
  return "error";
}

/**
 * Report one failure. Never throws — `captureException` already guarantees
 * that, and `ProxyAIProvider.report` catches anyway.
 */
export function reportAIProxyFailure(failure: ProxyFailure): void {
  const level = severityForAIFailure(failure);
  const tags = {
    provider: "proxy",
    stage: failure.stage,
    ...(failure.status != null ? { status: String(failure.status) } : {}),
  };

  // Errors get a stack so the call site is identifiable; the quieter
  // levels are states, not exceptions, and read better as messages.
  if (level === "error") {
    captureException(new Error(`AI proxy failed: ${failure.message}`), {
      level,
      tags,
      extra: { stage: failure.stage, status: failure.status },
    });
    return;
  }

  captureMessage(`AI proxy unavailable: ${failure.message}`, {
    level,
    tags,
    extra: { stage: failure.stage, status: failure.status },
  });
}
