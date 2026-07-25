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

    const promptParts = [input.goal];
    if (input.context && Object.keys(input.context).length > 0) {
      promptParts.push(JSON.stringify(input.context));
    }

    return this.launchPlanner.decompose({
      workspaceId: input.workspace.id,
      decisionId,
      prompt: promptParts.join("\n"),
    });
  }
}

export const planner = new ChronosPlanner();
