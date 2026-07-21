/**
 * Post-auth bootstrap for public beta:
 * Create Profile → Personal Workspace → Owner Membership → Preferences
 *
 * Best-effort against Supabase when online; always works local-first.
 */
import type { User } from "@supabase/supabase-js";
import { workspaceService } from "./WorkspaceService";
import {
  loadUserPreferences,
  saveUserPreferences,
} from "../../infrastructure/auth/userPreferencesStore";
import { isE2EAuthEnabled } from "../../infrastructure/auth/e2eAuth";
import { supabase } from "../../infrastructure/supabase/client";
import { trackProductEvent } from "../../infrastructure/analytics/productAnalytics";
import type { WorkspaceHome } from "../../domain/workspace/types";

export type BootstrapResult = {
  home: WorkspaceHome | null;
  profileCreated: boolean;
  workspaceBootstrapped: boolean;
};

function displayNameFromUser(user: User): string {
  const meta = user.user_metadata ?? {};
  const name =
    (typeof meta.full_name === "string" && meta.full_name) ||
    (typeof meta.name === "string" && meta.name) ||
    (typeof meta.user_name === "string" && meta.user_name) ||
    user.email?.split("@")[0] ||
    "Chronos";
  return name.trim() || "Chronos";
}

function providerFromUser(user: User): string | null {
  const app = user.app_metadata as { provider?: string } | undefined;
  return app?.provider ?? null;
}

export class AccountBootstrapService {
  /**
   * Ensure profile row + personal workspace + owner membership exist.
   * Safe to call on every session; idempotent.
   */
  async ensureAccount(user: User): Promise<BootstrapResult> {
    const userId = user.id;
    let profileCreated = false;
    let workspaceBootstrapped = false;

    // Preferences seed
    const provider = providerFromUser(user);
    if (provider) {
      saveUserPreferences(userId, { preferredAuthProvider: provider });
    } else {
      loadUserPreferences(userId);
    }

    // Cloud profile (best-effort)
    if (!isE2EAuthEnabled()) {
      try {
        const displayName = displayNameFromUser(user);
        const { error } = await supabase.from("profiles").upsert(
          {
            id: userId,
            email: user.email ?? null,
            display_name: displayName,
            avatar_url:
              typeof user.user_metadata?.avatar_url === "string"
                ? user.user_metadata.avatar_url
                : null,
            preferred_auth_provider: provider,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "id" }
        );
        if (!error) profileCreated = true;
      } catch (err) {
        console.warn("[chronos] profile upsert failed; continuing local bootstrap.", err);
      }
    } else {
      profileCreated = true;
    }

    // Workspace bootstrap
    let home = await workspaceService.load(userId);
    if (!home) {
      const name = `${displayNameFromUser(user)}'s Workspace`;
      home = await workspaceService.createWorkspace(
        userId,
        name,
        "Personal Decision Workspace"
      );
      workspaceBootstrapped = true;
      trackProductEvent("workspace_created", {
        source: "bootstrap",
        workspaceId: home.workspace.id,
      });
    }

    // Owner membership row (best-effort cloud)
    if (!isE2EAuthEnabled() && home) {
      try {
        await supabase.from("workspace_members").upsert(
          {
            workspace_id: home.workspace.id,
            user_id: userId,
            role: "owner",
          },
          { onConflict: "workspace_id,user_id" }
        );
      } catch (err) {
        console.warn("[chronos] workspace_members upsert failed.", err);
      }
    }

    return { home, profileCreated, workspaceBootstrapped };
  }
}

export const accountBootstrapService = new AccountBootstrapService();
