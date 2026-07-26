/**
 * Cache identity for a simulation result. Every input that can affect an
 * outcome belongs here; changing any field creates a distinct cache entry.
 */
export type SimulationCacheInput = {
  prompt: string;
  workspaceId: string;
  modelVersion: string;
  configuration: Record<string, unknown>;
};

export type CachedSimulation<T> = {
  key: string;
  value: T;
  createdAt: string;
  expiresAt?: string;
};

export interface SimulationCache<T> {
  get(key: string): Promise<CachedSimulation<T> | null>;
  set(entry: CachedSimulation<T>): Promise<void>;
  delete(key: string): Promise<void>;
}

/** Stable JSON serialization avoids cache misses from object key ordering. */
export function stableSerialize(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(",")}]`;

  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableSerialize(record[key])}`)
    .join(",")}}`;
}

/** FNV-1a is sufficient for deterministic lookup keys; it is not a security hash. */
function fnv1a(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function createSimulationCacheKey(input: SimulationCacheInput): string {
  const canonical = stableSerialize({
    prompt: input.prompt.trim().toLowerCase(),
    workspace: input.workspaceId,
    modelVersion: input.modelVersion,
    configuration: input.configuration,
  });

  return `sim_${fnv1a(canonical)}`;
}

export function isCacheEntryFresh<T>(entry: CachedSimulation<T>, now = new Date()): boolean {
  return !entry.expiresAt || new Date(entry.expiresAt).getTime() > now.getTime();
}
