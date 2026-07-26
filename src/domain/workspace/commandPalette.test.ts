import { describe, expect, it } from "vitest";
import {
  buildPaletteCommands,
  filterPaletteCommands,
  knowledgeSearchCommand,
} from "./commandPalette";
import type { SimulationRecord, WorkspaceHome } from "./types";

function home(sims: SimulationRecord[] = []): WorkspaceHome {
  return {
    workspace: {
      id: "w1",
      owner_id: "u1",
      name: "Lab",
      description: "",
      created_at: "2026-01-01T00:00:00.000Z",
    },
    goal: null,
    goalHistory: [],
    recentSimulations: sims,
    knowledge: [],
    notes: [],
    futuresBySimulation: {},
    timelineBySimulation: {},
  };
}

const completed: SimulationRecord = {
  id: "s1",
  workspace_id: "w1",
  goal_id: null,
  title: "How should we launch?",
  status: "completed",
  confidence: 0.7,
  result: {},
  created_at: "2026-01-02T00:00:00.000Z",
  version: 1,
  lineage_id: "s1",
  parent_simulation_id: null,
};

describe("commandPalette", () => {
  it("without a completed run there is nothing to review or log", () => {
    const ids = buildPaletteCommands(home()).map((c) => c.id);
    expect(ids).toContain("simulate");
    expect(ids).not.toContain("review");
    expect(ids).not.toContain("outcome");
  });

  it("a completed run adds review + log outcome deep-links", () => {
    const commands = buildPaletteCommands(home([completed]));
    const review = commands.find((c) => c.id === "review");
    expect(review?.href).toBe("/workspace/simulations/s1");
    expect(review?.hint).toBe("How should we launch?");
    expect(commands.some((c) => c.id === "outcome")).toBe(true);
  });

  it("filters case-insensitively across label and hint", () => {
    const commands = buildPaletteCommands(home([completed]));
    expect(filterPaletteCommands(commands, "MEMORY").map((c) => c.id)).toEqual(["memory"]);
    // "history" only appears in the timeline command's hint
    expect(filterPaletteCommands(commands, "history").map((c) => c.id)).toEqual(["timeline"]);
    expect(filterPaletteCommands(commands, "")).toHaveLength(commands.length);
  });

  it("knowledge fallback encodes the query", () => {
    const cmd = knowledgeSearchCommand("beta pricing?");
    expect(cmd.href).toBe("/workspace/knowledge?q=beta%20pricing%3F");
    expect(cmd.kind).toBe("ASK");
  });
});
