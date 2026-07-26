import type { SupabaseClient } from "@supabase/supabase-js";
import type { Simulation } from "../../domain/chronos/entities";
import { supabase } from "../supabase/client";

type SimulationRecordRow = {
  id: string;
  payload: Simulation;
  updated_at: string;
};

/** Read-only dashboard queries; writes belong to repository adapters. */
export class SupabaseSimulationQueries {
  constructor(private readonly client: SupabaseClient = supabase) {}

  async recent(limit = 20): Promise<Simulation[]> {
    const { data, error } = await this.client
      .from("chronos_records")
      .select("id, payload, updated_at")
      .eq("collection", "simulations")
      .order("updated_at", { ascending: false })
      .limit(limit)
      .returns<SimulationRecordRow[]>();

    if (error) throw new Error(`Simulation query failed: ${error.message}`);
    return (data ?? []).map((record) => record.payload);
  }
}

export const simulationQueries = new SupabaseSimulationQueries();
