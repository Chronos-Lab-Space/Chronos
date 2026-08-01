import { describe, expect, it } from "vitest";
import { DEFAULT_PREFERENCES, type UserPreferences } from "./betaChecklist";
import { dismissContextPromptFor, isContextPromptDismissed } from "./contextPrompt";

function prefs(patch: Partial<UserPreferences> = {}): UserPreferences {
  return { ...DEFAULT_PREFERENCES, ...patch };
}

describe("context prompt dismissal", () => {
  it("asks about a decision the visitor has not answered for", () => {
    expect(isContextPromptDismissed(prefs(), "decision-1")).toBe(false);
  });

  it("stays quiet about the decision they answered", () => {
    const answered = prefs(dismissContextPromptFor(prefs(), "decision-1"));

    expect(isContextPromptDismissed(answered, "decision-1")).toBe(true);
  });

  it("asks again when they open a different decision", () => {
    // The whole point of the change: one "Not now" used to silence the only
    // in-flow context ask left, for every decision the visitor would ever
    // make.
    const answered = prefs(dismissContextPromptFor(prefs(), "decision-1"));

    expect(isContextPromptDismissed(answered, "decision-2")).toBe(false);
  });

  it("does not record the same decision twice", () => {
    const once = prefs(dismissContextPromptFor(prefs(), "decision-1"));
    const twice = prefs(dismissContextPromptFor(once, "decision-1"));

    expect(twice.contextPromptDismissedFor).toEqual(["decision-1"]);
  });
});

describe("legacy global dismissal", () => {
  const legacy = prefs({ contextPromptDismissedAll: true });

  it("is honoured for everything until it can be expanded", () => {
    // It cannot name the decisions it answered for, so re-asking someone who
    // already said no is the one outcome that must not happen.
    expect(isContextPromptDismissed(legacy, "decision-1")).toBe(true);
    expect(isContextPromptDismissed(legacy, "decision-2")).toBe(true);
  });
});
