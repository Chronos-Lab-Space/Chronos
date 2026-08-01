import { describe, expect, it } from "vitest";
import { isWorkspaceOnboarded } from "./onboarding";
import type { WorkspaceHome } from "./types";

describe("workspace onboarded predicate", () => {
  it("is satisfied by a workspace and a goal, with no knowledge or notes", () => {
    const home = {
      workspace: { id: "ws-1", name: "Workspace" },
      goal: { title: "Launch the beta" },
      knowledge: [],
      notes: [],
    } as unknown as WorkspaceHome;

    // Context used to gate this. It no longer does: the first result is what
    // motivates attaching a source, so requiring one first inverted the order.
    expect(isWorkspaceOnboarded(home)).toBe(true);
  });

  it("is not satisfied by a workspace without a goal", () => {
    const home = {
      workspace: { id: "ws-1", name: "Workspace" },
      goal: null,
      knowledge: [],
      notes: [],
    } as unknown as WorkspaceHome;

    expect(isWorkspaceOnboarded(home)).toBe(false);
  });

  it("is not satisfied without a workspace", () => {
    expect(isWorkspaceOnboarded(null)).toBe(false);
  });
});
