/**
 * Resume-path resilience: this store is what restores a returning user's
 * workspace. Corrupt payloads, legacy keys, and half-shaped records must
 * degrade to safe defaults — never throw, never wipe other owners.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { LocalWorkspaceStore } from "./LocalWorkspaceStore";

const V4 = "chronos.workspace.v4";
const OWNER = "owner-1";

function makeHome(id: string, name = "Lab", createdAt = "2026-07-01T00:00:00.000Z") {
  return {
    workspace: { id, owner_id: OWNER, name, description: "", created_at: createdAt },
    goal: null,
    goalHistory: [],
    recentSimulations: [],
    knowledge: [],
    notes: [],
    futuresBySimulation: {},
    timelineBySimulation: {},
  };
}

describe("LocalWorkspaceStore resilience", () => {
  let store: LocalWorkspaceStore;

  beforeEach(() => {
    localStorage.clear();
    store = new LocalWorkspaceStore();
  });

  it("survives corrupt JSON and recovers on the next save", () => {
    localStorage.setItem(V4, "{definitely not json");

    expect(store.get(OWNER)).toBeNull();
    expect(store.list(OWNER)).toEqual([]);
    expect(store.getActiveId(OWNER)).toBeNull();

    const saved = store.save(OWNER, makeHome("w1"));
    expect(saved.workspace.id).toBe("w1");
    expect(store.get(OWNER)?.workspace.id).toBe("w1");
  });

  it("treats valid-but-wrong-shaped JSON as an empty store", () => {
    for (const payload of ['"just a string"', "42", "[]", '{"foo":1}']) {
      localStorage.setItem(V4, payload);
      expect(store.get(OWNER)).toBeNull();
      expect(store.list(OWNER)).toEqual([]);
    }
  });

  it("isolates a corrupt owner entry from other owners", () => {
    localStorage.setItem(
      V4,
      JSON.stringify({
        byOwner: {
          [OWNER]: "garbage-entry",
          "owner-2": { activeId: "w2", byId: { w2: makeHome("w2", "Other") } },
        },
      })
    );

    expect(store.get(OWNER)).toBeNull();
    expect(store.get("owner-2")?.workspace.name).toBe("Other");
  });

  it("reads the newest legacy key when v4 is absent (v3 wins over v2)", () => {
    localStorage.setItem(
      "chronos.workspace.v3",
      JSON.stringify({
        byOwner: { [OWNER]: { activeId: "w3", byId: { w3: makeHome("w3", "V3") } } },
      })
    );
    localStorage.setItem(
      "chronos.workspace.v2",
      JSON.stringify({
        byOwner: { [OWNER]: { activeId: "w2", byId: { w2: makeHome("w2", "V2") } } },
      })
    );

    expect(store.get(OWNER)?.workspace.name).toBe("V3");
  });

  it("persists the legacy migration to v4 on first save", () => {
    localStorage.setItem(
      "chronos.workspace.v1",
      JSON.stringify({
        byOwner: { [OWNER]: { activeId: "w1", byId: { w1: makeHome("w1", "V1") } } },
      })
    );

    const home = store.get(OWNER);
    expect(home?.workspace.name).toBe("V1");

    store.save(OWNER, { ...home!, workspace: { ...home!.workspace, name: "Migrated" } });
    expect(localStorage.getItem(V4)).toContain("Migrated");
    // v4 now wins even though the legacy key still exists
    expect(store.get(OWNER)?.workspace.name).toBe("Migrated");
  });

  it("migrates a legacy single-home owner entry into a bundle", () => {
    // Pre-bundle era: byOwner[owner] was a bare WorkspaceHome, and older
    // records lack goalHistory, relation maps, version, and lineage fields.
    localStorage.setItem(
      V4,
      JSON.stringify({
        byOwner: {
          [OWNER]: {
            workspace: {
              id: "w-legacy",
              owner_id: OWNER,
              name: "Old Home",
              created_at: "2026-01-01T00:00:00.000Z",
            },
            goal: null,
            recentSimulations: [
              {
                id: "sim-legacy",
                workspace_id: "w-legacy",
                goal_id: null,
                title: "Old sim",
                status: "completed",
                confidence: 0.4,
                created_at: "2026-01-02T00:00:00.000Z",
              },
            ],
            knowledge: null,
            notes: null,
          },
        },
      })
    );

    const home = store.get(OWNER);
    expect(home?.workspace.id).toBe("w-legacy");
    expect(home?.workspace.description).toBe("");
    expect(home?.goalHistory).toEqual([]);
    expect(home?.knowledge).toEqual([]);
    expect(home?.notes).toEqual([]);
    expect(home?.futuresBySimulation).toEqual({});

    const sim = home?.recentSimulations[0];
    expect(sim?.version).toBe(1);
    expect(sim?.lineage_id).toBe("sim-legacy");
    expect(sim?.parent_simulation_id).toBeNull();
    expect(sim?.result).toEqual({});

    expect(store.getActiveId(OWNER)).toBe("w-legacy");
    expect(store.list(OWNER).map((w) => w.id)).toEqual(["w-legacy"]);
  });

  it("repairs an activeId that points at a missing workspace", () => {
    localStorage.setItem(
      V4,
      JSON.stringify({
        byOwner: { [OWNER]: { activeId: "deleted", byId: { alive: makeHome("alive") } } },
      })
    );

    expect(store.getActiveId(OWNER)).toBe("alive");
    expect(store.get(OWNER)?.workspace.id).toBe("alive");
  });

  it("ignores setActiveId for unknown workspaces", () => {
    store.save(OWNER, makeHome("w1"));
    store.setActiveId(OWNER, "does-not-exist");
    expect(store.getActiveId(OWNER)).toBe("w1");
  });

  it("clear removes one owner without touching others", () => {
    store.save(OWNER, makeHome("w1"));
    store.save("owner-2", makeHome("w2", "Other"));

    store.clear(OWNER);

    expect(store.get(OWNER)).toBeNull();
    expect(store.get("owner-2")?.workspace.name).toBe("Other");
  });
});
