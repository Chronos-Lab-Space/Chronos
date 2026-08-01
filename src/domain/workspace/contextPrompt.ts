import type { UserPreferences } from "./betaChecklist";

/**
 * Who gets asked to add context, and about what.
 *
 * The prompt appears under a decision report, where a note is motivated by a
 * recommendation the visitor has just read. It was gated on a single boolean
 * per visitor, so the first Save or "Not now" silenced it for every decision
 * they would ever make — and with the wizard's context step deleted, this is
 * the only in-flow context ask left. A question they have not been asked
 * about gets asked.
 */

/** Dismissed for this decision — saved a note, or declined. */
export function isContextPromptDismissed(prefs: UserPreferences, decisionId: string): boolean {
  // A pre-per-decision dismissal cannot name the decisions it answered for.
  // Honouring it for everything until `expandLegacyContextDismissal` runs is
  // the safe direction: re-asking someone who already said no is the failure
  // that matters.
  if (prefs.contextPromptDismissedAll) return true;
  return prefs.contextPromptDismissedFor.includes(decisionId);
}

export function dismissContextPromptFor(
  prefs: UserPreferences,
  decisionId: string
): Partial<UserPreferences> {
  return {
    contextPromptDismissedFor: [...new Set([...prefs.contextPromptDismissedFor, decisionId])],
  };
}

/**
 * Reads a legacy global dismissal as "dismissed for everything that existed
 * at that point", and writes down what that turned out to be: the decisions
 * in the workspace the first time it loads under per-decision semantics.
 * Anything opened after is a new question, and gets asked.
 *
 * Returns null when there is nothing to upgrade, so callers can skip the
 * write.
 */
export function expandLegacyContextDismissal(
  prefs: UserPreferences,
  decisionIds: readonly string[]
): Partial<UserPreferences> | null {
  if (!prefs.contextPromptDismissedAll) return null;
  return {
    contextPromptDismissedFor: [...new Set([...prefs.contextPromptDismissedFor, ...decisionIds])],
    contextPromptDismissedAll: false,
  };
}
