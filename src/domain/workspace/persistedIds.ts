import type { FutureRecord, TimelineNodeRecord, WorkspaceHome } from "./types";

/**
 * Postgres `uuid` columns reject demo ids (`0x8d21`, `var-…`, etc.).
 * Repair any non-UUID primary keys before dual-write / local resume.
 */

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value.trim());
}

export function newUuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    const v = ch === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function asUuid(candidate: unknown): string {
  if (isUuid(candidate)) return candidate.trim();
  return newUuid();
}

/**
 * Remint non-UUID future / timeline ids and rewrite chosen_future_id references.
 * Simulation / workspace / goal ids are assumed UUID (created via crypto.randomUUID).
 */
export function sanitizeWorkspaceHomeIds(home: WorkspaceHome): WorkspaceHome {
  const futuresBySimulation: Record<string, FutureRecord[]> = {};
  const timelineBySimulation: Record<string, TimelineNodeRecord[]> = {};
  const recentSimulations = home.recentSimulations.map((sim) => {
    const idMap = new Map<string, string>();

    const futures = (home.futuresBySimulation[sim.id] ?? []).map((f) => {
      const nextId = asUuid(f.id);
      if (f.id !== nextId) idMap.set(f.id, nextId);
      return {
        ...f,
        id: nextId,
        simulation_id: sim.id,
      };
    });

    const nodes = (home.timelineBySimulation[sim.id] ?? []).map((n) => {
      const nextId = asUuid(n.id);
      if (n.id !== nextId) idMap.set(n.id, nextId);
      return n;
    });

    // Second pass: parent_id may have been reminted
    const remappedNodes = nodes.map((n) => {
      const id = idMap.get(n.id) ?? (isUuid(n.id) ? n.id : asUuid(n.id));
      const parent =
        n.parent_id == null
          ? null
          : (idMap.get(n.parent_id) ?? (isUuid(n.parent_id) ? n.parent_id : null));
      return {
        ...n,
        id: isUuid(n.id) ? n.id : id,
        parent_id: parent,
        simulation_id: sim.id,
      };
    });
    // Ensure node ids are uuid after map from first pass
    const finalNodes = remappedNodes.map((n) => ({
      ...n,
      id: asUuid(n.id),
      parent_id: n.parent_id && isUuid(n.parent_id) ? n.parent_id : null,
    }));

    futuresBySimulation[sim.id] = futures;
    timelineBySimulation[sim.id] = finalNodes;

    const chosenRaw = sim.result?.chosen_future_id;
    const chosen =
      typeof chosenRaw === "string"
        ? (idMap.get(chosenRaw) ?? (isUuid(chosenRaw) ? chosenRaw : undefined))
        : undefined;

    // Collapse is binary: a concrete future UUID or absent — never null.
    if (chosen === chosenRaw) {
      return sim;
    }

    return {
      ...sim,
      result: {
        ...sim.result,
        chosen_future_id: chosen,
      },
    };
  });

  return {
    ...home,
    recentSimulations,
    futuresBySimulation: {
      ...home.futuresBySimulation,
      ...futuresBySimulation,
    },
    timelineBySimulation: {
      ...home.timelineBySimulation,
      ...timelineBySimulation,
    },
  };
}
