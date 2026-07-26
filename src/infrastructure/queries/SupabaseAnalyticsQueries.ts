import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "../supabase/client";

export type AnalyticsEvent = {
  event: string;
  properties?: Record<string, unknown>;
};

/** Best-effort event writer. Analytics must never break a user interaction. */
export class SupabaseAnalyticsQueries {
  constructor(private readonly client: SupabaseClient = supabase) {}

  async track(event: AnalyticsEvent): Promise<void> {
    try {
      const { error } = await this.client.from("events").insert({
        event: event.event,
        properties: event.properties ?? {},
        user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
        path: typeof window !== "undefined" ? window.location.pathname : null,
      });

      if (error) console.warn("[chronos] analytics track failed:", error.message);
    } catch (error) {
      console.warn("[chronos] analytics track failed:", error);
    }
  }
}

export const analyticsQueries = new SupabaseAnalyticsQueries();
