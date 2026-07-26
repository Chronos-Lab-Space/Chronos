import type { SupabaseClient } from "@supabase/supabase-js";
import type { CachedSimulation, SimulationCache } from "../../domain/chronos/simulation-cache";
import { supabase } from "../supabase/client";

type CacheRow<T> = {
  cache_key: string;
  payload: T;
  created_at: string;
  expires_at: string | null;
};

/**
 * Shared result cache. Use this adapter from a trusted server/edge process,
 * not the public browser client, because prompts can contain sensitive data.
 */
export class SupabaseSimulationCache<T> implements SimulationCache<T> {
  constructor(private readonly client: SupabaseClient = supabase) {}

  async get(key: string): Promise<CachedSimulation<T> | null> {
    const { data, error } = await this.client
      .from("simulation_cache")
      .select("cache_key, payload, created_at, expires_at")
      .eq("cache_key", key)
      .maybeSingle<CacheRow<T>>();

    if (error) throw new Error(`Simulation cache lookup failed: ${error.message}`);
    if (!data) return null;
    return {
      key: data.cache_key,
      value: data.payload,
      createdAt: data.created_at,
      expiresAt: data.expires_at ?? undefined,
    };
  }

  async set(entry: CachedSimulation<T>): Promise<void> {
    const { error } = await this.client.from("simulation_cache").upsert(
      {
        cache_key: entry.key,
        payload: entry.value,
        created_at: entry.createdAt,
        expires_at: entry.expiresAt ?? null,
      },
      { onConflict: "cache_key" }
    );
    if (error) throw new Error(`Simulation cache write failed: ${error.message}`);
  }

  async delete(key: string): Promise<void> {
    const { error } = await this.client.from("simulation_cache").delete().eq("cache_key", key);
    if (error) throw new Error(`Simulation cache delete failed: ${error.message}`);
  }
}
