import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "../supabase/client";

export type AccessRequestInput = {
  email: string;
  identity: string;
  agentProject: string;
  chronosMotivation: string;
  source?: string;
  userAgent?: string | null;
};

export type AccessRequestResult =
  | { ok: true; id?: string }
  | { ok: false; error: string };

/**
 * Persistence adapter for the Cohort access queue. It owns validation and
 * duplicate-email behavior so presentation components never touch table names.
 */
export class SupabaseAccessRequestRepository {
  constructor(private readonly client: SupabaseClient = supabase) {}

  async submit(input: AccessRequestInput): Promise<AccessRequestResult> {
    const email = input.email.toLowerCase().trim();
    const identity = input.identity.trim();
    const agentProject = input.agentProject.trim();
    const chronosMotivation = input.chronosMotivation.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return { ok: false, error: "Invalid email address." };
    }
    if (!identity || !agentProject || !chronosMotivation) {
      return { ok: false, error: "Complete every field before requesting access." };
    }

    // Browser workflow tests run without a real Supabase project. This flag is
    // supplied only by the Playwright dev server and never by production builds.
    if (import.meta.env.VITE_MOCK_ACCESS_REQUESTS === "true") {
      return { ok: true, id: `mock-${email}` };
    }

    try {
      const { error } = await this.client.from("access_requests").insert({
        email,
        identity,
        agent_project: agentProject,
        chronos_motivation: chronosMotivation,
        source: input.source ?? "unknown",
        user_agent:
          input.userAgent ??
          (typeof navigator !== "undefined" ? navigator.userAgent : null),
      });

      if (error) {
        // The queue is idempotent by email. A second request is still success.
        if (error.code === "23505") return { ok: true };
        return { ok: false, error: error.message };
      }

      return { ok: true };
    } catch (error) {
      return { ok: false, error: (error as Error).message };
    }
  }
}

export const accessRequestRepository = new SupabaseAccessRequestRepository();