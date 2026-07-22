import {
  DEFAULT_PREFERENCES,
  type UserPreferences,
} from "../../domain/workspace/betaChecklist";

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

function normalize(raw: Partial<UserPreferences> | Record<string, unknown> | undefined): UserPreferences {
  const r = raw ?? {};
  return {
    shareAcknowledged: Boolean(r.shareAcknowledged),
    preferredAuthProvider:
      typeof r.preferredAuthProvider === "string" ? r.preferredAuthProvider : null,
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
