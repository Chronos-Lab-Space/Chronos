import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  isOutcomeReviewNotifyEnabled,
  notificationPermission,
  notifyIfDueCountChanged,
  requestNotificationPermission,
  setOutcomeReviewNotifyEnabled,
} from "./outcomeReviewNotifier";

function mockNotification(permission: NotificationPermission) {
  const ctor = vi.fn();
  class FakeNotification {
    static permission = permission;
    static requestPermission = vi.fn(async () => permission);
    constructor(...args: unknown[]) {
      ctor(...args);
    }
  }
  // biome-ignore lint/suspicious/noExplicitAny: test-only global stub
  (globalThis as any).Notification = FakeNotification;
  return ctor;
}

describe("outcomeReviewNotifier", () => {
  const originalNotification = (globalThis as { Notification?: unknown }).Notification;

  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    (globalThis as { Notification?: unknown }).Notification = originalNotification;
  });

  it("is disabled by default", () => {
    expect(isOutcomeReviewNotifyEnabled()).toBe(false);
  });

  it("persists the opt-in preference", () => {
    setOutcomeReviewNotifyEnabled(true);
    expect(isOutcomeReviewNotifyEnabled()).toBe(true);
    setOutcomeReviewNotifyEnabled(false);
    expect(isOutcomeReviewNotifyEnabled()).toBe(false);
  });

  it("reports the browser's permission state", () => {
    mockNotification("granted");
    expect(notificationPermission()).toBe("granted");
  });

  it("requests permission through the Notification API", async () => {
    mockNotification("default");
    const result = await requestNotificationPermission();
    expect(result).toBe("default");
  });

  it("does not notify when the preference is off, even with permission granted", () => {
    const ctor = mockNotification("granted");
    expect(notifyIfDueCountChanged(2)).toBe(false);
    expect(ctor).not.toHaveBeenCalled();
  });

  it("does not notify without granted permission, even when opted in", () => {
    const ctor = mockNotification("default");
    setOutcomeReviewNotifyEnabled(true);
    expect(notifyIfDueCountChanged(2)).toBe(false);
    expect(ctor).not.toHaveBeenCalled();
  });

  it("notifies once for a given due count", () => {
    const ctor = mockNotification("granted");
    setOutcomeReviewNotifyEnabled(true);

    expect(notifyIfDueCountChanged(2)).toBe(true);
    expect(ctor).toHaveBeenCalledTimes(1);

    // Same count again -- a re-render must not re-fire.
    expect(notifyIfDueCountChanged(2)).toBe(false);
    expect(ctor).toHaveBeenCalledTimes(1);
  });

  it("notifies again when the due count grows", () => {
    const ctor = mockNotification("granted");
    setOutcomeReviewNotifyEnabled(true);

    notifyIfDueCountChanged(1);
    notifyIfDueCountChanged(2);

    expect(ctor).toHaveBeenCalledTimes(2);
  });

  it("does not notify for zero due", () => {
    const ctor = mockNotification("granted");
    setOutcomeReviewNotifyEnabled(true);
    expect(notifyIfDueCountChanged(0)).toBe(false);
    expect(ctor).not.toHaveBeenCalled();
  });
});
