import type {
  FutureRecord,
  SimulationRecord,
  TimelineNodeRecord,
  WorkspaceHome,
} from "./types";

/**
 * Merge remote + local workspace homes for cloud memory sync.
 *
 * Strategy (append-friendly history):
 * - Prefer remote workspace/goal metadata when present
 * - Union simulations, knowledge, notes by id (remote wins on shared ids)
 * - Union futures/timeline maps; for shared sim ids prefer remote arrays when non-empty
 */
export function mergeWorkspaceHomes(
  remote: WorkspaceHome,
  local: WorkspaceHome
): WorkspaceHome {
  // Same workspace id expected; if mismatched, remote is source of truth for identity.
  const workspace =
    remote.workspace.id === local.workspace.id
      ? {
          ...local.workspace,
          ...remote.workspace,
          description: remote.workspace.description || local.workspace.description,
        }
      : remote.workspace;

  const goal = remote.goal ?? local.goal;

  return {
    workspace,
    goal,
    recentSimulations: mergeById(
      remote.recentSimulations,
      local.recentSimulations,
      (s) => s.id,
      (remoteSim, localSim) => preferRicherSimulation(remoteSim, localSim)
    ).sort((a, b) => b.created_at.localeCompare(a.created_at)),
    knowledge: mergeById(remote.knowledge, local.knowledge, (k) => k.id, preferRemote),
    notes: mergeById(remote.notes, local.notes, (n) => n.id, preferRemote),
    futuresBySimulation: mergeRelationMaps(
      remote.futuresBySimulation,
      local.futuresBySimulation
    ),
    timelineBySimulation: mergeRelationMaps(
      remote.timelineBySimulation,
      local.timelineBySimulation
    ),
  };
}

function preferRemote<T>(remote: T, _local: T): T {
  return remote;
}

function preferRicherSimulation(
  remote: SimulationRecord,
  local: SimulationRecord
): SimulationRecord {
  // Prefer completed over running/queued when ids collide across devices.
  const remoteDone = remote.status === "completed" || remote.status === "failed";
  const localDone = local.status === "completed" || local.status === "failed";
  if (remoteDone && !localDone) return remote;
  if (localDone && !remoteDone) return local;
  // Prefer higher version / richer result payload.
  if ((local.version ?? 1) > (remote.version ?? 1)) return { ...remote, ...local, id: remote.id };
  return {
    ...local,
    ...remote,
    result: { ...(local.result ?? {}), ...(remote.result ?? {}) },
  };
}

function mergeById<T>(
  remote: readonly T[],
  local: readonly T[],
  idOf: (item: T) => string,
  resolve: (remote: T, local: T) => T
): T[] {
  const map = new Map<string, T>();
  for (const item of local) map.set(idOf(item), item);
  for (const item of remote) {
    const id = idOf(item);
    const existing = map.get(id);
    map.set(id, existing ? resolve(item, existing) : item);
  }
  return [...map.values()];
}

function mergeRelationMaps<T extends FutureRecord | TimelineNodeRecord>(
  remote: Record<string, readonly T[]>,
  local: Record<string, readonly T[]>
): Record<string, readonly T[]> {
  const keys = new Set([...Object.keys(remote), ...Object.keys(local)]);
  const out: Record<string, readonly T[]> = {};
  for (const key of keys) {
    const r = remote[key] ?? [];
    const l = local[key] ?? [];
    if (r.length === 0 && l.length === 0) continue;
    if (r.length === 0) {
      out[key] = l;
      continue;
    }
    if (l.length === 0) {
      out[key] = r;
      continue;
    }
    // Union by id when both present
    const byId = new Map<string, T>();
    for (const item of l) byId.set(item.id, item);
    for (const item of r) byId.set(item.id, item);
    out[key] = [...byId.values()];
  }
  return out;
}

/** True when local has product memory worth uploading to an empty cloud. */
export function hasLocalMemory(home: WorkspaceHome): boolean {
  return (
    home.recentSimulations.length > 0 ||
    home.knowledge.length > 0 ||
    home.notes.length > 0 ||
    Boolean(home.goal) ||
    Boolean(home.workspace?.id)
  );
}
