import type { WorkspaceHome } from "../../domain/workspace/types";

const STORAGE_KEY = "chronos.workspace.v1";

type StoreShape = {
  byOwner: Record<string, WorkspaceHome>;
};

function emptyStore(): StoreShape {
  return { byOwner: {} };
}

function readStore(): StoreShape {
  if (typeof localStorage === "undefined") return emptyStore();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyStore();
    const parsed = JSON.parse(raw) as StoreShape;
    if (!parsed || typeof parsed !== "object" || !parsed.byOwner) return emptyStore();
    return parsed;
  } catch {
    return emptyStore();
  }
}

function writeStore(store: StoreShape) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

/**
 * Browser resume store. The success metric requires a user to leave and come back
 * without losing workspace / goal / context / simulations.
 */
export class LocalWorkspaceStore {
  get(ownerId: string): WorkspaceHome | null {
    return readStore().byOwner[ownerId] ?? null;
  }

  save(ownerId: string, home: WorkspaceHome): WorkspaceHome {
    const store = readStore();
    store.byOwner[ownerId] = home;
    writeStore(store);
    return home;
  }

  clear(ownerId: string) {
    const store = readStore();
    delete store.byOwner[ownerId];
    writeStore(store);
  }
}

export const localWorkspaceStore = new LocalWorkspaceStore();
