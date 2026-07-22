import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../queries/SupabaseAnalyticsQueries", () => ({
  analyticsQueries: { track: vi.fn().mockResolvedValue(undefined) },
}));

import {
  formatDurationMs,
  getProductAnalyticsSnapshot,
  trackProductEvent,
} from "./productAnalytics";

describe("productAnalytics", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("counts workspace, sim, decision, export and computes time to first decision", () => {
    trackProductEvent("session_start");
    trackProductEvent("workspace_created", { name: "Lab" });
    trackProductEvent("simulation_started");
    trackProductEvent("simulation_completed", { status: "completed" });
    trackProductEvent("path_chosen", { simulationId: "s1" });
    trackProductEvent("report_exported");

    const snap = getProductAnalyticsSnapshot();
    expect(snap.workspace_created).toBe(1);
    expect(snap.simulation_started).toBe(1);
    expect(snap.simulation_completed).toBe(1);
    expect(snap.path_chosen).toBe(1);
    expect(snap.report_exported).toBe(1);
    expect(snap.sessions).toBeGreaterThanOrEqual(1);
    expect(snap.first_workspace_at).toBeTruthy();
    expect(snap.first_decision_at).toBeTruthy();
    expect(snap.time_to_first_decision_ms).not.toBeNull();
    expect(snap.retention_days).toBeGreaterThanOrEqual(1);
  });

  it("formats durations", () => {
    expect(formatDurationMs(null)).toBe("—");
    expect(formatDurationMs(5_000)).toMatch(/s/);
    expect(formatDurationMs(120_000)).toMatch(/m/);
  });
});
