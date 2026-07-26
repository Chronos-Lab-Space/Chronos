import type {
  Repository,
  RepositoryListOptions,
  RepositoryRecord,
} from "../../domain/chronos/repositories";

/**
 * Ephemeral repository adapter for local demos, tests, and offline execution.
 * It implements the same port as remote and SQLite-backed repositories.
 */
export class MemoryRepository<T extends RepositoryRecord> implements Repository<T> {
  private readonly records = new Map<string, T>();

  constructor(seed: T[] = []) {
    for (const record of seed) this.records.set(record.id, record);
  }

  async get(id: string): Promise<T | null> {
    return this.records.get(id) ?? null;
  }

  async list(options: RepositoryListOptions = {}): Promise<T[]> {
    const items = [...this.records.values()];
    const offset = options.offset ?? 0;
    const limit = options.limit ?? items.length;
    return items.slice(offset, offset + limit);
  }

  async save(record: T): Promise<T> {
    this.records.set(record.id, record);
    return record;
  }

  async delete(id: string): Promise<void> {
    this.records.delete(id);
  }

  clear() {
    this.records.clear();
  }
}
