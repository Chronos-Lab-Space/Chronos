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
export function isContextPromptDismissed(
  prefs: UserPreferences,
  decisionId: string,
  decisionCreatedAt?: string
): boolean {
  // A pre-per-decision dismissal cannot name the decisions it answered for.
  // Honouring it for everything until the upgrade runs is the safe direction:
  // re-asking someone who already said no is the failure that matters.
  if (prefs.contextPromptDismissedAll) return true;
  if (prefs.contextPromptDismissedFor.includes(decisionId)) return true;

  // Everything that existed when the visitor said no, in every workspace.
  // A missing timestamp is never read as "before" — that would dismiss the
  // prompt for a decision nobody declined.
  const before = prefs.contextPromptDismissedBefore;
  return Boolean(before && decisionCreatedAt && decisionCreatedAt < before);
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
 * when I said no", and records that as a moment rather than a list of ids.
 *
 * The first version listed the decisions in the workspace that happened to be
 * loaded, then cleared the flag one-way — so a visitor with a second workspace
 * was asked again there, and a cloud load that half-failed froze an incomplete
 * list permanently. A timestamp needs no enumeration, so neither failure has
 * anywhere to happen.
 *
 * Returns null when there is nothing to upgrade, so callers can skip the write.
 */
export function upgradeLegacyContextDismissal(
  prefs: UserPreferences,
  now: string
): Partial<UserPreferences> | null {
  if (!prefs.contextPromptDismissedAll) return null;
  return {
    contextPromptDismissedBefore: now,
    contextPromptDismissedAll: false,
  };
}
