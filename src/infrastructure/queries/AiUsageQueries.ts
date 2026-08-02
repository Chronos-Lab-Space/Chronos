/**
 * Read-only ai_usage for the signed-in user (RLS: own rows only).
 * Writes stay in the Edge Function admin client — never from the SPA.
 */
import { isSupabaseConfigured, supabase } from "../supabase/client";

export type AiUsageRow = {
  id: string;
  created_at: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  stop_reason: string | null;
  ok: boolean;
};

export type AiUsageSummary = {
  rows: AiUsageRow[];
  totalCalls: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  failedCalls: number;
  /** Calls in the last 60 seconds (rate-limit window). */
  callsLastMinute: number;
};

const EMPTY: AiUsageSummary = {
  rows: [],
  totalCalls: 0,
  totalInputTokens: 0,
  totalOutputTokens: 0,
  failedCalls: 0,
  callsLastMinute: 0,
};

export async function fetchOwnAiUsage(limit = 50): Promise<AiUsageSummary> {
  if (!isSupabaseConfigured || !supabase) return EMPTY;

  const { data, error } = await supabase
    .from("ai_usage")
    .select("id, created_at, model, input_tokens, output_tokens, stop_reason, ok")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error || !data) return EMPTY;

  const rows = data as AiUsageRow[];
  const minuteAgo = Date.now() - 60_000;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let failedCalls = 0;
  let callsLastMinute = 0;

  for (const row of rows) {
    totalInputTokens += row.input_tokens ?? 0;
    totalOutputTokens += row.output_tokens ?? 0;
    if (!row.ok) failedCalls += 1;
    if (Date.parse(row.created_at) >= minuteAgo) callsLastMinute += 1;
  }

  return {
    rows,
    totalCalls: rows.length,
    totalInputTokens,
    totalOutputTokens,
    failedCalls,
    callsLastMinute,
  };
}
