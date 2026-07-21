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

export function loadUserPreferences(userId: string): UserPreferences {
  const all = readAll();
  return { ...DEFAULT_PREFERENCES, ...(all[userId] ?? {}) };
}

export function saveUserPreferences(
  userId: string,
  prefs: Partial<UserPreferences>
): UserPreferences {
  const all = readAll();
  const next = { ...loadUserPreferences(userId), ...prefs };
  all[userId] = next;
  writeAll(all);
  return next;
}
