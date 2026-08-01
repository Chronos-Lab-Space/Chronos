import { beforeEach, describe, expect, it } from "vitest";
import type { WorkspaceHome } from "../../domain/workspace/types";
import { claimAnonymousWork } from "./claimAnonymousWork";
import { LocalWorkspaceStore } from "./LocalWorkspaceStore";

const ANON = "anon-11111111-1111-4111-8111-111111111111";
const USER = "22222222-2222-4222-8222-222222222222";

function home(name: string, simTitle?: string): WorkspaceHome {
  return {
    workspace: {
      id: `ws-${name}`,
      owner_id: "pending",
      name,
      description: "",
      created_at: "2026-07-01T00:00:00.000Z",
    },
    goal: null,
    goalHistory: [],
    knowledge: [],
    notes: [],
    recentSimulations: simTitle
      ? [
          {
            id: `sim-${name}`,
            workspace_id: `ws-${name}`,
            goal_id: null,
            title: simTitle,
            status: "completed",
            confidence: 0.7,
            result: {},
            created_at: "2026-07-02T00:00:00.000Z",
            version: 1,
            lineage_id: `sim-${name}`,
            parent_simulation_id: null,
          },
        ]
      : [],
    futuresBySimulation: {},
    timelineBySimulation: {},
  } as unknown as WorkspaceHome;
}

describe("claimAnonymousWork", () => {
  let store: LocalWorkspaceStore;

  beforeEach(() => {
    localStorage.clear();
    store = new LocalWorkspaceStore();
  });

  it("moves anonymous work to a fresh account", () => {
    store.save(ANON, home("Anon Lab", "Anonymous decision"));

    const result = claimAnonymousWork(store, ANON, USER);

    expect(result.outcome).toBe("claimed");
    expect(store.get(USER)?.workspace.name).toBe("Anon Lab");
    expect(store.get(USER)?.recentSimulations[0]?.title).toBe("Anonymous decision");
    // The anonymous bundle is gone — one copy, not two.
    expect(store.get(ANON)).toBeNull();
  });

  it("refuses to merge into an account that already has work", () => {
    store.save(ANON, home("Anon Lab", "Anonymous decision"));
    store.save(USER, home("Real Lab", "Existing decision"));

    const result = claimAnonymousWork(store, ANON, USER);

    // Interleaving two decision histories would corrupt the one thing Chronos
    // promises to remember, so neither side is touched.
    expect(result.outcome).toBe("kept-separate");
    expect(store.get(USER)?.workspace.name).toBe("Real Lab");
    expect(store.get(ANON)?.workspace.name).toBe("Anon Lab");
  });

  it("treats an account with an empty workspace as claimable", () => {
    store.save(ANON, home("Anon Lab", "Anonymous decision"));
    // Bootstrap creates a workspace with no runs — that is not "work".
    store.save(USER, home("Personal", undefined));

    const result = claimAnonymousWork(store, ANON, USER);

    expect(result.outcome).toBe("claimed");
    expect(store.get(USER)?.recentSimulations[0]?.title).toBe("Anonymous decision");
  });

  it("does nothing when there is no anonymous work", () => {
    store.save(USER, home("Real Lab", "Existing decision"));

    const result = claimAnonymousWork(store, ANON, USER);

    expect(result.outcome).toBe("nothing-to-claim");
    expect(store.get(USER)?.workspace.name).toBe("Real Lab");
  });

  it("does not claim an anonymous bundle that has no decisions", () => {
    // An id minted by merely visiting is not work worth moving.
    store.save(ANON, home("Untouched", undefined));

    const result = claimAnonymousWork(store, ANON, USER);

    expect(result.outcome).toBe("nothing-to-claim");
    expect(store.get(USER)).toBeNull();
  });

  it("refuses to claim into an anonymous target", () => {
    // Guard against a caller passing ids in the wrong order and re-keying real
    // work onto a throwaway identity.
    store.save(ANON, home("Anon Lab", "Anonymous decision"));

    const result = claimAnonymousWork(store, ANON, "anon-33333333-3333-4333-8333-333333333333");

    expect(result.outcome).toBe("refused");
    expect(store.get(ANON)?.workspace.name).toBe("Anon Lab");
  });
});
