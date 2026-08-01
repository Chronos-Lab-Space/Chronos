import { beforeEach, describe, expect, it } from "vitest";
import { loadUserPreferences, saveUserPreferences } from "./userPreferencesStore";

const KEY = "chronos.user.preferences.v1";

describe("userPreferencesStore", () => {
  beforeEach(() => localStorage.clear());

  it("reads a dismissal stored under the original onboarding key", () => {
    // Two renames later, a visitor who dismissed the context ask in the
    // wizard must not be asked again about the decisions they had then.
    localStorage.setItem(KEY, JSON.stringify({ "user-1": { onboardingContextSkipped: true } }));

    expect(loadUserPreferences("user-1").contextPromptDismissedAll).toBe(true);
  });

  it("reads a dismissal stored under the global boolean that replaced it", () => {
    localStorage.setItem(KEY, JSON.stringify({ "user-1": { contextPromptDismissed: true } }));

    expect(loadUserPreferences("user-1").contextPromptDismissedAll).toBe(true);
  });

  it("prefers the newer key when both are present", () => {
    localStorage.setItem(
      KEY,
      JSON.stringify({
        "user-1": { onboardingContextSkipped: true, contextPromptDismissed: false },
      })
    );

    expect(loadUserPreferences("user-1").contextPromptDismissedAll).toBe(false);
  });

  it("round-trips the decisions the prompt has been answered for", () => {
    saveUserPreferences("user-1", { contextPromptDismissedFor: ["decision-1", "decision-2"] });

    expect(loadUserPreferences("user-1").contextPromptDismissedFor).toEqual([
      "decision-1",
      "decision-2",
    ]);
  });

  it("ignores a stored dismissal list that is not a list of ids", () => {
    localStorage.setItem(KEY, JSON.stringify({ "user-1": { contextPromptDismissedFor: true } }));

    expect(loadUserPreferences("user-1").contextPromptDismissedFor).toEqual([]);
  });
});
