import type { LearningMemoryRecord } from "../../domain/workspace/productLearning";

const STORAGE_KEY = "chronos.learning.memory.v1";

type StoreShape = {
  byWorkspace: Record<string, LearningMemoryRecord[]>;
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

/**
 * Durable product learning memory (local). Never throws.
 * Cloud dual-write can be layered later without changing agents.
 */
export class LearningMemoryStore {
  append(workspaceId: string, records: readonly LearningMemoryRecord[]): number {
    if (!workspaceId || records.length === 0) return 0;
    try {
      const store = readStore();
      const existing = store.byWorkspace[workspaceId] ?? [];
      const byId = new Map(existing.map((r) => [r.id, r]));
      for (const record of records) {
        byId.set(record.id, record);
      }
      // Newest first, cap history
      const merged = [...byId.values()]
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, 200);
      store.byWorkspace[workspaceId] = merged;
      writeStore(store);
      return records.length;
    } catch {
      return 0;
    }
  }

  list(workspaceId: string): LearningMemoryRecord[] {
    if (!workspaceId) return [];
    try {
      return [...(readStore().byWorkspace[workspaceId] ?? [])];
    } catch {
      return [];
    }
  }

  clear(workspaceId?: string): void {
    try {
      if (!workspaceId) {
        if (typeof localStorage !== "undefined") localStorage.removeItem(STORAGE_KEY);
        return;
      }
      const store = readStore();
      delete store.byWorkspace[workspaceId];
      writeStore(store);
    } catch {
      /* ignore */
    }
  }
}

export const learningMemoryStore = new LearningMemoryStore();
