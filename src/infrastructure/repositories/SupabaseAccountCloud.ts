/**
 * Supabase adapter for AccountBootstrapService's cloud port.
 * Best-effort: callers catch and continue local bootstrap.
 */
import type {
  AccountCloudPort,
  AccountProfileUpsert,
} from "../../application/workspace/AccountBootstrapService";
import { supabase } from "../supabase/client";

export class SupabaseAccountCloud implements AccountCloudPort {
  async upsertProfile(profile: AccountProfileUpsert): Promise<boolean> {
    const { error } = await supabase.from("profiles").upsert(
      {
        id: profile.id,
        email: profile.email,
        display_name: profile.display_name,
        avatar_url: profile.avatar_url,
        preferred_auth_provider: profile.preferred_auth_provider,
        updated_at: profile.updated_at,
      },
      { onConflict: "id" }
    );
    return !error;
  }

  async upsertOwnerMembership(workspaceId: string, userId: string): Promise<void> {
    await supabase.from("workspace_members").upsert(
      {
        workspace_id: workspaceId,
        user_id: userId,
        role: "owner",
      },
      { onConflict: "workspace_id,user_id" }
    );
  }
}

export const supabaseAccountCloud = new SupabaseAccountCloud();
