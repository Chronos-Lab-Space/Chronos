import { beforeEach, describe, expect, it } from "vitest";
import { loadUserPreferences } from "./userPreferencesStore";

const KEY = "chronos.user.preferences.v1";

describe("userPreferencesStore", () => {
  beforeEach(() => localStorage.clear());

  it("reads a dismissal stored under the old key", () => {
    // Renaming the field must not re-prompt everyone who already dismissed it.
    localStorage.setItem(KEY, JSON.stringify({ "user-1": { onboardingContextSkipped: true } }));

    expect(loadUserPreferences("user-1").contextPromptDismissed).toBe(true);
  });

  it("prefers the new key when both are present", () => {
    localStorage.setItem(
      KEY,
      JSON.stringify({
        "user-1": { onboardingContextSkipped: true, contextPromptDismissed: false },
      })
    );

    expect(loadUserPreferences("user-1").contextPromptDismissed).toBe(false);
  });
});
