/**
 * API / request authentication pipeline for workspace-scoped actions.
 *
 * JWT → Verify session → Get user → Get workspace → Check membership → Execute
 */
import type { WorkspaceHome, WorkspaceRecord } from "./types";

export type WorkspaceRole = "owner" | "admin" | "member" | "viewer";

export type AuthAccessContext = {
  userId: string;
  workspaceId: string;
  role: WorkspaceRole;
};

export type AccessDenial =
  | { ok: false; code: "unauthenticated"; message: string }
  | { ok: false; code: "not_found"; message: string }
  | { ok: false; code: "forbidden"; message: string };

export type AccessGrant = { ok: true; access: AuthAccessContext };

export type AccessResult = AccessGrant | AccessDenial;

/**
 * Pure membership check used by services and tests.
 * Owner on WorkspaceRecord always passes as owner role.
 */
export function resolveWorkspaceAccess(input: {
  userId: string | null | undefined;
  workspace: WorkspaceRecord | null | undefined;
  membershipRole?: WorkspaceRole | null;
}): AccessResult {
  if (!input.userId) {
    return {
      ok: false,
      code: "unauthenticated",
      message: "Sign in required. Missing or invalid session.",
    };
  }
  if (!input.workspace) {
    return {
      ok: false,
      code: "not_found",
      message: "Workspace not found.",
    };
  }

  if (input.workspace.owner_id === input.userId) {
    return {
      ok: true,
      access: {
        userId: input.userId,
        workspaceId: input.workspace.id,
        role: "owner",
      },
    };
  }

  if (input.membershipRole) {
    return {
      ok: true,
      access: {
        userId: input.userId,
        workspaceId: input.workspace.id,
        role: input.membershipRole,
      },
    };
  }

  return {
    ok: false,
    code: "forbidden",
    message: "You are not a member of this workspace.",
  };
}

/** Require at least the given role rank for mutating operations. */
const ROLE_RANK: Record<WorkspaceRole, number> = {
  viewer: 1,
  member: 2,
  admin: 3,
  owner: 4,
};

export function requireRole(
  access: AuthAccessContext,
  minimum: WorkspaceRole
): AccessResult {
  if (ROLE_RANK[access.role] >= ROLE_RANK[minimum]) {
    return { ok: true, access };
  }
  return {
    ok: false,
    code: "forbidden",
    message: `Requires ${minimum} role or higher.`,
  };
}

export function accessFromHome(
  userId: string | null | undefined,
  home: WorkspaceHome | null
): AccessResult {
  return resolveWorkspaceAccess({
    userId,
    workspace: home?.workspace ?? null,
  });
}
