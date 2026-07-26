import type { CachedSimulation, SimulationCache } from "../../domain/chronos/simulation-cache";

/** Session-local cache for browser demos and offline development. */
export class MemorySimulationCache<T> implements SimulationCache<T> {
  private readonly entries = new Map<string, CachedSimulation<T>>();

  async get(key: string): Promise<CachedSimulation<T> | null> {
    return this.entries.get(key) ?? null;
  }

  async set(entry: CachedSimulation<T>): Promise<void> {
    this.entries.set(entry.key, entry);
  }

  async delete(key: string): Promise<void> {
    this.entries.delete(key);
  }

  clear() {
    this.entries.clear();
  }
}
