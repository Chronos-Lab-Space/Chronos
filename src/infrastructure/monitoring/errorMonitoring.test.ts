import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  captureException,
  captureMessage,
  initErrorMonitoring,
  isErrorMonitoringEnabled,
} from "./errorMonitoring";

describe("errorMonitoring scaffold", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("init without DSN leaves monitoring disabled", async () => {
    await initErrorMonitoring();
    expect(isErrorMonitoringEnabled()).toBe(false);
  });

  it("captureException never throws", () => {
    expect(() =>
      captureException(new Error("boom"), { tags: { area: "test" } })
    ).not.toThrow();
  });

  it("captureMessage never throws", () => {
    expect(() => captureMessage("hello", { level: "warning" })).not.toThrow();
  });
});
