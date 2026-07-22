import type { WorkspaceHome, WorkspaceRecord } from "../../domain/workspace/types";

const STORAGE_KEY = "chronos.workspace.v4";
const LEGACY_KEYS = ["chronos.workspace.v3", "chronos.workspace.v2", "chronos.workspace.v1"] as const;

type OwnerBundle = {
  activeId: string | null;
  byId: Record<string, WorkspaceHome>;
};

type StoreShape = {
  byOwner: Record<string, OwnerBundle | WorkspaceHome>;
};

function emptyStore(): StoreShape {
  return { byOwner: {} };
}

function normalizeHome(home: WorkspaceHome): WorkspaceHome {
  return {
    ...home,
    workspace: {
      ...home.workspace,
      description: home.workspace.description ?? "",
    },
    goalHistory: home.goalHistory ?? [],
    futuresBySimulation: home.futuresBySimulation ?? {},
    timelineBySimulation: home.timelineBySimulation ?? {},
    recentSimulations: (home.recentSimulations ?? []).map((sim) => {
      const lineage = sim.lineage_id || sim.id;
      return {
        ...sim,
        result: sim.result ?? {},
        title: sim.title ?? "",
        version: typeof sim.version === "number" && sim.version > 0 ? sim.version : 1,
        lineage_id: lineage,
        parent_simulation_id: sim.parent_simulation_id ?? null,
      };
    }),
    knowledge: home.knowledge ?? [],
    notes: home.notes ?? [],
  };
}

function isLegacyHome(value: unknown): value is WorkspaceHome {
  return Boolean(
    value &&
      typeof value === "object" &&
      "workspace" in value &&
      "recentSimulations" in value &&
      !("byId" in value)
  );
}

function normalizeBundle(raw: OwnerBundle | WorkspaceHome | undefined): OwnerBundle {
  if (!raw) return { activeId: null, byId: {} };
  if (isLegacyHome(raw)) {
    const home = normalizeHome(raw);
    return { activeId: home.workspace.id, byId: { [home.workspace.id]: home } };
  }
  const byId: Record<string, WorkspaceHome> = {};
  for (const [id, home] of Object.entries(raw.byId ?? {})) {
    byId[id] = normalizeHome(home);
  }
  const activeId =
    raw.activeId && byId[raw.activeId]
      ? raw.activeId
      : Object.keys(byId)[0] ?? null;
  return { activeId, byId };
}

function readStore(): StoreShape {
  if (typeof localStorage === "undefined") return emptyStore();
  try {
    let raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      for (const key of LEGACY_KEYS) {
        raw = localStorage.getItem(key);
        if (raw) break;
      }
    }
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

/** Multi-workspace browser store with active workspace pointer. */
export class LocalWorkspaceStore {
  get(ownerId: string, workspaceId?: string): WorkspaceHome | null {
    const bundle = normalizeBundle(readStore().byOwner[ownerId]);
    const id = workspaceId ?? bundle.activeId;
    if (!id) return null;
    return bundle.byId[id] ?? null;
  }

  list(ownerId: string): WorkspaceRecord[] {
    const bundle = normalizeBundle(readStore().byOwner[ownerId]);
    return Object.values(bundle.byId)
      .map((h) => h.workspace)
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  }

  getActiveId(ownerId: string): string | null {
    return normalizeBundle(readStore().byOwner[ownerId]).activeId;
  }

  setActiveId(ownerId: string, workspaceId: string) {
    const store = readStore();
    const bundle = normalizeBundle(store.byOwner[ownerId]);
    if (!bundle.byId[workspaceId]) return;
    bundle.activeId = workspaceId;
    store.byOwner[ownerId] = bundle;
    writeStore(store);
  }

  save(ownerId: string, home: WorkspaceHome): WorkspaceHome {
    const normalized = normalizeHome(home);
    const store = readStore();
    const bundle = normalizeBundle(store.byOwner[ownerId]);
    bundle.byId[normalized.workspace.id] = normalized;
    bundle.activeId = normalized.workspace.id;
    store.byOwner[ownerId] = bundle;
    writeStore(store);
    return normalized;
  }

  clear(ownerId: string) {
    const store = readStore();
    delete store.byOwner[ownerId];
    writeStore(store);
  }
}

export const localWorkspaceStore = new LocalWorkspaceStore();
