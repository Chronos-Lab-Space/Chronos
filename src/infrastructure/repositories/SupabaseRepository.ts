import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Repository,
  RepositoryListOptions,
  RepositoryRecord,
} from "../../domain/chronos/repositories";

type StoredRecordRow = {
  id: string;
  payload: unknown;
};

/**
 * Supabase implementation of the generic Chronos repository port.
 * Records are stored in `chronos_records`, namespaced by collection, which
 * lets SimulationRepository, AgentRepository, MemoryRepository, and
 * ScenarioRepository share one durable persistence model.
 */
export class SupabaseRepository<T extends RepositoryRecord> implements Repository<T> {
  constructor(
    private readonly client: SupabaseClient,
    private readonly collection: string
  ) {}

  async get(id: string): Promise<T | null> {
    const { data, error } = await this.client
      .from("chronos_records")
      .select("id, payload")
      .eq("collection", this.collection)
      .eq("id", id)
      .maybeSingle<StoredRecordRow>();

    if (error) throw new Error(`Supabase get failed: ${error.message}`);
    return data ? this.deserialize(data) : null;
  }

  async list(options: RepositoryListOptions = {}): Promise<T[]> {
    const offset = options.offset ?? 0;
    const limit = options.limit ?? 100;
    const { data, error } = await this.client
      .from("chronos_records")
      .select("id, payload")
      .eq("collection", this.collection)
      .order("updated_at", { ascending: false })
      .range(offset, offset + limit - 1)
      .returns<StoredRecordRow[]>();

    if (error) throw new Error(`Supabase list failed: ${error.message}`);
    return (data ?? []).map((row) => this.deserialize(row));
  }

  async save(record: T): Promise<T> {
    const { error } = await this.client.from("chronos_records").upsert(
      {
        collection: this.collection,
        id: record.id,
        payload: record,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "collection,id" }
    );

    if (error) throw new Error(`Supabase save failed: ${error.message}`);
    return record;
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.client
      .from("chronos_records")
      .delete()
      .eq("collection", this.collection)
      .eq("id", id);

    if (error) throw new Error(`Supabase delete failed: ${error.message}`);
  }

  private deserialize(row: StoredRecordRow): T {
    return row.payload as T;
  }
}
