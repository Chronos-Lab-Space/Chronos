import { describe, expect, it } from "vitest";
import { requireRole, resolveWorkspaceAccess } from "./authAccess";

const workspace = {
  id: "w1",
  owner_id: "owner-1",
  name: "Lab",
  description: "",
  created_at: "2026-01-01T00:00:00.000Z",
};

describe("authAccess pipeline", () => {
  it("denies missing session", () => {
    const r = resolveWorkspaceAccess({ userId: null, workspace });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("unauthenticated");
  });

  it("grants owner access", () => {
    const r = resolveWorkspaceAccess({ userId: "owner-1", workspace });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.access.role).toBe("owner");
  });

  it("grants member role from membership", () => {
    const r = resolveWorkspaceAccess({
      userId: "u2",
      workspace,
      membershipRole: "member",
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.access.role).toBe("member");
  });

  it("forbids strangers", () => {
    const r = resolveWorkspaceAccess({ userId: "stranger", workspace });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("forbidden");
  });

  it("requireRole enforces rank", () => {
    const grant = resolveWorkspaceAccess({
      userId: "u2",
      workspace,
      membershipRole: "viewer",
    });
    expect(grant.ok).toBe(true);
    if (!grant.ok) return;
    const denied = requireRole(grant.access, "admin");
    expect(denied.ok).toBe(false);
    const ok = requireRole(grant.access, "viewer");
    expect(ok.ok).toBe(true);
  });
});
