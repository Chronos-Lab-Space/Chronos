import { describe, expect, it } from "vitest";
import { StartupLaunchPlanner } from "../../application/planner/StartupLaunchPlanner";
import { SIMULATION_STAGES } from "./simulation-stages";

describe("SIMULATION_STAGES", () => {
  it("never advertises a planner task the public simulator does not execute", () => {
    // The public simulator calls simulate() directly — it never runs the task
    // graph through the capability registry. Showing planner titles as pipeline
    // steps claims work that does not happen.
    const plannerTitles = new StartupLaunchPlanner()
      .decompose({
        workspaceId: "public-startup-simulator",
        decisionId: "simulate-page",
        prompt: "AI meeting assistant",
      })
      .tasks.map((task) => task.title);
    const stageLabels = SIMULATION_STAGES.map((stage) => stage.label);

    for (const title of plannerTitles) {
      expect(stageLabels).not.toContain(title);
    }
  });

  it("states no sample count of its own, so labels cannot drift from the real budget", () => {
    // The draw count is a runtime value (sampleBudget rounded to whole
    // archetypes). Baking a number into a label is how "1000 branches"
    // marketing copy outlives the engine that stopped drawing 1000.
    for (const stage of SIMULATION_STAGES) {
      expect(stage.label).not.toMatch(/\d/);
    }
  });
});
