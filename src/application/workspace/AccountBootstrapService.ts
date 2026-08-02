/**
 * Post-auth bootstrap for public beta:
 * Create Profile → Personal Workspace → Owner Membership → Preferences
 *
 * Application layer: no Supabase client, no localStorage, no analytics singleton.
 * Ports are injected; composition/workspaceService.ts supplies the adapters.
 */
import type { User } from "@supabase/supabase-js";
import type { UserPreferences } from "../../domain/workspace/betaChecklist";
import type { WorkspaceHome } from "../../domain/workspace/types";

export type BootstrapResult = {
  home: WorkspaceHome | null;
  profileCreated: boolean;
  workspaceBootstrapped: boolean;
};

/** The two workspace calls bootstrap makes. */
export type BootstrapWorkspaces = {
  load(ownerId: string): Promise<WorkspaceHome | null>;
  createWorkspace(ownerId: string, name: string, description: string): Promise<WorkspaceHome>;
};

export type AccountProfileUpsert = {
  id: string;
  email: string | null;
  display_name: string;
  avatar_url: string | null;
  preferred_auth_provider: string | null;
  updated_at: string;
};

/**
 * Cloud side of bootstrap: profile + owner membership.
 * Pass `null` for local-only / E2E — no network path exists.
 */
export type AccountCloudPort = {
  upsertProfile(profile: AccountProfileUpsert): Promise<boolean>;
  upsertOwnerMembership(workspaceId: string, userId: string): Promise<void>;
};

export type UserPreferencesPort = {
  load(userId: string): UserPreferences;
  save(userId: string, patch: Partial<UserPreferences>): void;
};

export type BootstrapAnalyticsPort = {
  trackWorkspaceCreated(props: { source: string; workspaceId: string }): void;
};

export type AccountBootstrapDeps = {
  workspaces: BootstrapWorkspaces;
  preferences: UserPreferencesPort;
  analytics: BootstrapAnalyticsPort;
  /** `null` skips all cloud profile/membership writes (E2E, offline tests). */
  cloud: AccountCloudPort | null;
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
  constructor(private readonly deps: AccountBootstrapDeps) {}

  /**
   * Ensure profile row + personal workspace + owner membership exist.
   * Safe to call on every session; idempotent.
   */
  async ensureAccount(user: User): Promise<BootstrapResult> {
    const { workspaces, preferences, analytics, cloud } = this.deps;
    const userId = user.id;
    let profileCreated = false;
    let workspaceBootstrapped = false;

    const provider = providerFromUser(user);
    if (provider) {
      preferences.save(userId, { preferredAuthProvider: provider });
    } else {
      preferences.load(userId);
    }

    if (cloud) {
      try {
        const displayName = displayNameFromUser(user);
        profileCreated = await cloud.upsertProfile({
          id: userId,
          email: user.email ?? null,
          display_name: displayName,
          avatar_url:
            typeof user.user_metadata?.avatar_url === "string"
              ? user.user_metadata.avatar_url
              : null,
          preferred_auth_provider: provider,
          updated_at: new Date().toISOString(),
        });
      } catch (err) {
        console.warn("[chronos] profile upsert failed; continuing local bootstrap.", err);
      }
    } else {
      // E2E / local-only: treat profile as present so the rest of the funnel continues.
      profileCreated = true;
    }

    let home = await workspaces.load(userId);
    if (!home) {
      const name = `${displayNameFromUser(user)}'s Workspace`;
      home = await workspaces.createWorkspace(userId, name, "Personal Decision Workspace");
      workspaceBootstrapped = true;
      analytics.trackWorkspaceCreated({
        source: "bootstrap",
        workspaceId: home.workspace.id,
      });
    }

    if (cloud && home) {
      try {
        await cloud.upsertOwnerMembership(home.workspace.id, userId);
      } catch (err) {
        console.warn("[chronos] workspace_members upsert failed.", err);
      }
    }

    return { home, profileCreated, workspaceBootstrapped };
  }
}

/** The wired singleton lives in `composition/workspaceService.ts`. */
