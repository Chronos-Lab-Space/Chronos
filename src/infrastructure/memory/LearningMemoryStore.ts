import type { LearningMemoryRecord } from "../../domain/workspace/productLearning";
import { isSupabaseConfigured, supabase } from "../supabase/client";

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

function titleFor(record: LearningMemoryRecord): string {
  const label =
    record.kind === "outcome"
      ? "Learning · outcome"
      : record.kind === "preference"
        ? "Learning · preference"
        : "Learning · decision";
  return `${label}: ${record.content.slice(0, 72)}`;
}

/**
 * Durable product learning memory.
 * Local: always. Cloud: best-effort upsert into public.knowledge (type=note).
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
      const merged = [...byId.values()]
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, 200);
      store.byWorkspace[workspaceId] = merged;
      writeStore(store);

      void this.dualWriteKnowledge(records);
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

  /** Preferences for planner injection (newest first). */
  listPreferences(workspaceId: string, limit = 5): string[] {
    return this.list(workspaceId)
      .filter((r) => r.kind === "preference")
      .slice(0, limit)
      .map((r) => r.content);
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

  /** Best-effort cloud dual-write — never throws to callers. */
  private async dualWriteKnowledge(records: readonly LearningMemoryRecord[]): Promise<void> {
    if (!isSupabaseConfigured || records.length === 0) return;
    try {
      const rows = records.map((r) => ({
        id: r.id,
        workspace_id: r.workspaceId,
        type: "note" as const,
        title: titleFor(r),
        content: r.content,
        metadata: {
          ...r.metadata,
          source: "learning",
          learning_kind: r.kind,
          simulation_id: r.simulationId,
        },
        created_at: r.createdAt,
      }));
      const { error } = await supabase.from("knowledge").upsert(rows);
      if (error) {
        console.warn("[learning] Supabase dual-write failed", error.message);
      }
    } catch (err) {
      console.warn("[learning] Supabase dual-write error", err);
    }
  }
}

export const learningMemoryStore = new LearningMemoryStore();
