import { describe, expect, it } from "vitest";
import { DEFAULT_PREFERENCES, type UserPreferences } from "./betaChecklist";
import { isContextPromptDismissed, upgradeLegacyContextDismissal } from "./contextPrompt";

function prefs(patch: Partial<UserPreferences> = {}): UserPreferences {
  return { ...DEFAULT_PREFERENCES, ...patch };
}

describe("legacy context dismissal", () => {
  it("covers decisions in every workspace, not just the one that happened to load", () => {
    // The id-list upgrade recorded only the active workspace's decisions and
    // then cleared the flag one-way, so a visitor with a second workspace was
    // asked again there — for a question they had already declined.
    const upgraded = upgradeLegacyContextDismissal(
      prefs({ contextPromptDismissedAll: true }),
      "2026-08-01T12:00:00.000Z"
    );

    expect(upgraded).not.toBeNull();
    const after = prefs(upgraded ?? {});

    // A decision from another workspace, never seen at upgrade time.
    expect(
      isContextPromptDismissed(after, "decision-in-other-workspace", "2026-07-30T09:00:00.000Z")
    ).toBe(true);
  });

  it("still asks about a decision created after the upgrade", () => {
    const after = prefs(
      upgradeLegacyContextDismissal(
        prefs({ contextPromptDismissedAll: true }),
        "2026-08-01T12:00:00.000Z"
      ) ?? {}
    );

    expect(isContextPromptDismissed(after, "decision-new", "2026-08-02T09:00:00.000Z")).toBe(false);
  });

  it("does not depend on a load that only half-succeeded", () => {
    // A cloud load that throws falls back to local-only. Under the id-list
    // upgrade that froze an incomplete list and retired the flag anyway.
    const upgraded = upgradeLegacyContextDismissal(
      prefs({ contextPromptDismissedAll: true }),
      "2026-08-01T12:00:00.000Z"
    );

    expect(upgraded?.contextPromptDismissedBefore).toBe("2026-08-01T12:00:00.000Z");
    expect(upgraded?.contextPromptDismissedAll).toBe(false);
  });

  it("leaves an explicit per-decision dismissal working", () => {
    const after = prefs({ contextPromptDismissedFor: ["decision-1"] });

    expect(isContextPromptDismissed(after, "decision-1", "2026-08-05T09:00:00.000Z")).toBe(true);
    expect(isContextPromptDismissed(after, "decision-2", "2026-08-05T09:00:00.000Z")).toBe(false);
  });

  it("has nothing to upgrade when there was no legacy dismissal", () => {
    expect(upgradeLegacyContextDismissal(prefs(), "2026-08-01T12:00:00.000Z")).toBeNull();
  });

  it("asks when a decision's creation time is unknown", () => {
    // Never silently treat a missing timestamp as "before the cutoff" — that
    // would dismiss the prompt for decisions nobody declined.
    const after = prefs(
      upgradeLegacyContextDismissal(
        prefs({ contextPromptDismissedAll: true }),
        "2026-08-01T12:00:00.000Z"
      ) ?? {}
    );

    expect(isContextPromptDismissed(after, "decision-x", undefined)).toBe(false);
  });
});
