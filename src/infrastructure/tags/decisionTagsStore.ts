const STORAGE_KEY = "chronos.decision.tags.v1";

type StoreShape = {
  byWorkspace: Record<string, Record<string, string[]>>;
};

function emptyStore(): StoreShape {
  return { byWorkspace: {} };
}

function readStore(): StoreShape {
  if (typeof localStorage === "undefined") return emptyStore();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyStore();
    const parsed = JSON.parse(raw) as Partial<StoreShape>;
    return { byWorkspace: parsed.byWorkspace ?? {} };
  } catch {
    return emptyStore();
  }
}

function writeStore(store: StoreShape): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    /* quota / private mode */
  }
}

/** Trimmed, deduped, case-preserved-but-case-insensitive-compared, sorted. */
function normalizeTags(tags: readonly string[]): string[] {
  const seen = new Map<string, string>();
  for (const raw of tags) {
    const trimmed = raw.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (!seen.has(key)) seen.set(key, trimmed);
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b));
}

/**
 * Decision tags — device-local only, on purpose.
 *
 * `decisions` is a real Supabase table with a fixed column set; tags would
 * need a migration to sync across devices, and this is the one avenue this
 * codebase avoids opening blind (see CLAUDE.md "Migration parity is the
 * rule, both directions" — a repair PR has already been paid for drift like
 * that). Tags live in localStorage instead, the same trade both anonymous
 * mode and calibration-adjacent local caches already make: real on this
 * device, gone if you clear site data, never assumed synced.
 */
export function tagsFor(workspaceId: string, decisionId: string): string[] {
  if (!workspaceId || !decisionId) return [];
  return readStore().byWorkspace[workspaceId]?.[decisionId] ?? [];
}

export function setTags(
  workspaceId: string,
  decisionId: string,
  tags: readonly string[]
): string[] {
  if (!workspaceId || !decisionId) return [];
  const normalized = normalizeTags(tags);
  const store = readStore();
  const workspace = { ...(store.byWorkspace[workspaceId] ?? {}) };
  if (normalized.length === 0) {
    delete workspace[decisionId];
  } else {
    workspace[decisionId] = normalized;
  }
  store.byWorkspace[workspaceId] = workspace;
  writeStore(store);
  return normalized;
}

/** Every distinct tag in use across the workspace, for the filter row. */
export function allTags(workspaceId: string): string[] {
  if (!workspaceId) return [];
  const workspace = readStore().byWorkspace[workspaceId] ?? {};
  return normalizeTags(Object.values(workspace).flat());
}
