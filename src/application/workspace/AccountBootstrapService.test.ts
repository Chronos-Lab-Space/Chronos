import type { User } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { DEFAULT_PREFERENCES } from "../../domain/workspace/betaChecklist";
import type { WorkspaceHome } from "../../domain/workspace/types";
import {
  AccountBootstrapService,
  type AccountCloudPort,
  type AccountProfileUpsert,
  type BootstrapAnalyticsPort,
  type BootstrapWorkspaces,
  type UserPreferencesPort,
} from "./AccountBootstrapService";

function user(partial: Partial<User> & { id: string }): User {
  return {
    app_metadata: {},
    user_metadata: {},
    aud: "authenticated",
    created_at: "2026-01-01T00:00:00.000Z",
    ...partial,
  } as User;
}

function emptyHome(ownerId: string): WorkspaceHome {
  return {
    workspace: {
      id: "ws-1",
      owner_id: ownerId,
      name: "Lab",
      description: "",
      created_at: "2026-01-01T00:00:00.000Z",
    },
    goal: null,
    goalHistory: [],
    recentSimulations: [],
    decisions: [],
    knowledge: [],
    notes: [],
    futuresBySimulation: {},
    timelineBySimulation: {},
  };
}

function prefsPort(): UserPreferencesPort & { saved: Record<string, unknown>[] } {
  const saved: Record<string, unknown>[] = [];
  return {
    saved,
    load: () => DEFAULT_PREFERENCES,
    save: (_id, patch) => {
      saved.push(patch);
    },
  };
}

describe("AccountBootstrapService", () => {
  it("creates a workspace when none exists and tracks the event", async () => {
    const created = emptyHome("u1");
    const workspaces: BootstrapWorkspaces = {
      load: vi.fn().mockResolvedValue(null),
      createWorkspace: vi.fn().mockResolvedValue(created),
    };
    const analytics: BootstrapAnalyticsPort = {
      trackWorkspaceCreated: vi.fn(),
    };
    const preferences = prefsPort();
    const cloud: AccountCloudPort = {
      upsertProfile: vi.fn().mockResolvedValue(true),
      upsertOwnerMembership: vi.fn().mockResolvedValue(undefined),
    };

    const service = new AccountBootstrapService({
      workspaces,
      preferences,
      analytics,
      cloud,
    });

    const result = await service.ensureAccount(
      user({ id: "u1", email: "a@b.co", user_metadata: { full_name: "Ada" } })
    );

    expect(result.workspaceBootstrapped).toBe(true);
    expect(result.profileCreated).toBe(true);
    expect(result.home?.workspace.id).toBe("ws-1");
    expect(workspaces.createWorkspace).toHaveBeenCalledWith(
      "u1",
      "Ada's Workspace",
      "Personal Decision Workspace"
    );
    expect(analytics.trackWorkspaceCreated).toHaveBeenCalledWith({
      source: "bootstrap",
      workspaceId: "ws-1",
    });
    expect(cloud.upsertOwnerMembership).toHaveBeenCalledWith("ws-1", "u1");
  });

  it("skips cloud writes when cloud port is null (E2E / local-only)", async () => {
    const existing = emptyHome("u1");
    const workspaces: BootstrapWorkspaces = {
      load: vi.fn().mockResolvedValue(existing),
      createWorkspace: vi.fn(),
    };
    const analytics: BootstrapAnalyticsPort = {
      trackWorkspaceCreated: vi.fn(),
    };
    const service = new AccountBootstrapService({
      workspaces,
      preferences: prefsPort(),
      analytics,
      cloud: null,
    });

    const result = await service.ensureAccount(user({ id: "u1" }));

    expect(result.profileCreated).toBe(true);
    expect(result.workspaceBootstrapped).toBe(false);
    expect(workspaces.createWorkspace).not.toHaveBeenCalled();
    expect(analytics.trackWorkspaceCreated).not.toHaveBeenCalled();
  });

  it("continues when profile upsert fails", async () => {
    const existing = emptyHome("u1");
    const cloud: AccountCloudPort = {
      upsertProfile: vi.fn().mockRejectedValue(new Error("network")),
      upsertOwnerMembership: vi.fn().mockResolvedValue(undefined),
    };
    const service = new AccountBootstrapService({
      workspaces: {
        load: vi.fn().mockResolvedValue(existing),
        createWorkspace: vi.fn(),
      },
      preferences: prefsPort(),
      analytics: { trackWorkspaceCreated: vi.fn() },
      cloud,
    });

    const result = await service.ensureAccount(user({ id: "u1" }));
    expect(result.home?.workspace.id).toBe("ws-1");
    expect(result.profileCreated).toBe(false);
    expect(cloud.upsertOwnerMembership).toHaveBeenCalled();
  });

  it("seeds preferred auth provider from the user metadata", async () => {
    const preferences = prefsPort();
    const service = new AccountBootstrapService({
      workspaces: {
        load: vi.fn().mockResolvedValue(emptyHome("u1")),
        createWorkspace: vi.fn(),
      },
      preferences,
      analytics: { trackWorkspaceCreated: vi.fn() },
      cloud: null,
    });

    await service.ensureAccount(
      user({ id: "u1", app_metadata: { provider: "google" } } as Partial<User> & { id: string })
    );

    expect(preferences.saved).toContainEqual({ preferredAuthProvider: "google" });
  });

  it("passes a plain profile DTO to the cloud port", async () => {
    const seen: AccountProfileUpsert[] = [];
    const cloud: AccountCloudPort = {
      upsertProfile: async (p) => {
        seen.push(p);
        return true;
      },
      upsertOwnerMembership: vi.fn().mockResolvedValue(undefined),
    };
    const service = new AccountBootstrapService({
      workspaces: {
        load: vi.fn().mockResolvedValue(emptyHome("u1")),
        createWorkspace: vi.fn(),
      },
      preferences: prefsPort(),
      analytics: { trackWorkspaceCreated: vi.fn() },
      cloud,
    });

    await service.ensureAccount(
      user({
        id: "u1",
        email: "x@y.z",
        user_metadata: { avatar_url: "https://img.example/a.png" },
      })
    );

    expect(seen).toHaveLength(1);
    expect(seen[0]?.id).toBe("u1");
    expect(seen[0]?.email).toBe("x@y.z");
    expect(seen[0]?.avatar_url).toBe("https://img.example/a.png");
  });
});
