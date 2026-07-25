import { StartupLaunchPlanner } from "../../application/planner/StartupLaunchPlanner";
import type { TaskGraph } from "../../domain/chronos/task-os";

export type CreatePlanInput = {
  goal: string;
  workspace: { id: string };
  context?: Record<string, unknown>;
  decisionId?: string;
};

/**
 * Planner produces a dependency-aware task graph.
 * It does not invoke the LLM or execute agents.
 */
export class ChronosPlanner {
  constructor(private readonly launchPlanner = new StartupLaunchPlanner()) {}

  async createPlan(input: CreatePlanInput): Promise<TaskGraph> {
    const decisionId =
      input.decisionId ??
      (typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `decision-${Date.now()}`);

    const learnedPreferences = Array.isArray(input.context?.learnedPreferences)
      ? (input.context!.learnedPreferences as string[]).map(String)
      : [];

    const promptParts = [input.goal];
    if (learnedPreferences.length > 0) {
      promptParts.push(
        "Learned preferences from prior decisions:",
        ...learnedPreferences.map((p, i) => `${i + 1}. ${p}`)
      );
    }
    if (input.context) {
      const rest: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(input.context)) {
        if (key === "learnedPreferences") continue;
        rest[key] = value;
      }
      if (Object.keys(rest).length > 0) {
        promptParts.push(JSON.stringify(rest));
      }
    }

    return this.launchPlanner.decompose({
      workspaceId: input.workspace.id,
      decisionId,
      prompt: promptParts.join("\n"),
      learnedPreferences,
    });
  }
}

export const planner = new ChronosPlanner();
