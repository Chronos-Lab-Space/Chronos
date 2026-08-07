import { describe, expect, it } from "vitest";
import { deriveCalibration } from "./calibration";
import { exportWorkspaceCsv, exportWorkspaceJson } from "./dataExport";
import type { SimulationRecord, WorkspaceHome } from "./types";

function sim(over: Partial<SimulationRecord> & Pick<SimulationRecord, "id">): SimulationRecord {
  return {
    workspace_id: "w1",
    goal_id: null,
    title: "How should we launch?",
    status: "completed",
    confidence: 0.72,
    result: {},
    created_at: "2026-07-24T00:00:00.000Z",
    version: 1,
    lineage_id: over.id,
    parent_simulation_id: null,
    decision_id: over.id,
    ...over,
  };
}

function home(sims: SimulationRecord[]): WorkspaceHome {
  return {
    workspace: { id: "w1", owner_id: "user-1", name: "Lab", description: "", created_at: "" },
    goal: null,
    goalHistory: [],
    decisions: [
      {
        id: "s1",
        workspace_id: "w1",
        title: "Raise or bootstrap?",
        description: "",
        goal_id: null,
        created_at: "2026-07-24T00:00:00.000Z",
      },
    ],
    recentSimulations: sims,
    knowledge: [],
    notes: [],
    futuresBySimulation: {},
    timelineBySimulation: {},
  };
}

describe("exportWorkspaceJson", () => {
  it("carries decisions, their versions, and the calibration summary", () => {
    const h = home([
      sim({
        id: "s1",
        confidence: 0.8,
        result: {
          chosen_future_id: "f1",
          chosen_future_name: "Bootstrap",
          chosen_at: "2026-07-25T00:00:00.000Z",
          outcome_followed: "yes",
          outcome_verdict: "as_expected",
        },
      }),
    ]);
    const calibration = deriveCalibration(h);

    const parsed = JSON.parse(exportWorkspaceJson(h, calibration));

    expect(parsed.workspace.name).toBe("Lab");
    expect(parsed.decisions).toHaveLength(1);
    expect(parsed.decisions[0].title).toBe("Raise or bootstrap?");
    expect(parsed.decisions[0].versions).toHaveLength(1);
    expect(parsed.decisions[0].versions[0].chosenPathName).toBe("Bootstrap");
    expect(parsed.decisions[0].versions[0].outcomeVerdict).toBe("as_expected");
    expect(parsed.calibration.totalMeasured).toBe(calibration.totalMeasured);
  });

  it("produces valid JSON for a workspace with nothing in it", () => {
    const h = home([]);
    const parsed = JSON.parse(exportWorkspaceJson(h, deriveCalibration(h)));
    expect(parsed.decisions).toEqual([]);
  });
});

describe("exportWorkspaceCsv", () => {
  it("emits one row per simulation version with a header row", () => {
    const h = home([
      sim({ id: "s1", confidence: 0.8, result: { chosen_future_name: "Bootstrap" } }),
    ]);

    const csv = exportWorkspaceCsv(h);
    const lines = csv.trim().split("\n");

    expect(lines[0]).toBe(
      "decision_id,decision_title,version,status,confidence,chosen_path,outcome_followed,outcome_verdict,created_at"
    );
    expect(lines).toHaveLength(2);
    expect(lines[1]).toContain("Bootstrap");
  });

  it("quotes fields containing commas", () => {
    const h: WorkspaceHome = {
      ...home([sim({ id: "s1" })]),
      decisions: [
        {
          id: "s1",
          workspace_id: "w1",
          title: "Raise, bootstrap, or wait?",
          description: "",
          goal_id: null,
          created_at: "2026-07-24T00:00:00.000Z",
        },
      ],
    };

    const csv = exportWorkspaceCsv(h);
    expect(csv).toContain('"Raise, bootstrap, or wait?"');
  });

  it("produces just a header row for an empty workspace", () => {
    const csv = exportWorkspaceCsv(home([]));
    expect(csv.trim().split("\n")).toHaveLength(1);
  });
});
