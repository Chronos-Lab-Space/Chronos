import { DEFAULT_PREFERENCES, type UserPreferences } from "../../domain/workspace/betaChecklist";

const KEY = "chronos.user.preferences.v1";

type StoreShape = Record<string, UserPreferences>;

function readAll(): StoreShape {
  if (typeof localStorage === "undefined") return {};
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    return JSON.parse(raw) as StoreShape;
  } catch {
    return {};
  }
}

function writeAll(store: StoreShape): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify(store));
  } catch {
    /* ignore */
  }
}

/**
 * Stored preferences are whatever an older build left behind, so this reads
 * an open record rather than a `UserPreferences` — the keys it has to fall
 * back on are ones the current type no longer has.
 */
function normalize(raw: Record<string, unknown> | undefined): UserPreferences {
  const r = raw ?? {};
  return {
    shareAcknowledged: Boolean(r.shareAcknowledged),
    preferredAuthProvider:
      typeof r.preferredAuthProvider === "string" ? r.preferredAuthProvider : null,
    contextPromptDismissedFor: Array.isArray(r.contextPromptDismissedFor)
      ? r.contextPromptDismissedFor.filter((id): id is string => typeof id === "string")
      : [],
    // Two dead keys, one meaning: the prompt was dismissed before it asked per
    // decision. Read so an existing dismissal survives, then expanded into the
    // decisions it covered — see `expandLegacyContextDismissal`.
    contextPromptDismissedAll: Boolean(
      r.contextPromptDismissedAll ?? r.contextPromptDismissed ?? r.onboardingContextSkipped
    ),
    contextPromptDismissedBefore:
      typeof r.contextPromptDismissedBefore === "string" ? r.contextPromptDismissedBefore : null,
  };
}

export function loadUserPreferences(userId: string): UserPreferences {
  const all = readAll();
  return { ...DEFAULT_PREFERENCES, ...normalize(all[userId]) };
}

export function saveUserPreferences(
  userId: string,
  prefs: Partial<UserPreferences>
): UserPreferences {
  const all = readAll();
  const next = normalize({ ...loadUserPreferences(userId), ...prefs });
  all[userId] = next;
  writeAll(all);
  return next;
}
