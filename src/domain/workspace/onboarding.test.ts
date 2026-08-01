import { describe, expect, it } from "vitest";
import { isWorkspaceOnboarded, showsEntrySurface } from "./onboarding";
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

describe("entry surface", () => {
  const onboarded = {
    workspace: { id: "ws-1", name: "Workspace" },
    goal: { title: "Launch the beta" },
    knowledge: [],
    notes: [],
  } as unknown as WorkspaceHome;

  it("stays up while a submit it started is still running", () => {
    // The goal is already saved here — that is exactly the mid-submit state
    // that used to unmount the screen and strand the run.
    expect(showsEntrySurface(onboarded, true)).toBe(true);
  });

  it("gives way once the submit settles", () => {
    expect(showsEntrySurface(onboarded, false)).toBe(false);
  });

  it("is up for a visitor who has no decision yet", () => {
    expect(showsEntrySurface(null, false)).toBe(true);
  });
});
