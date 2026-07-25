import type { Agent, AgentResult, AgentTask } from "../types";

export class EvaluationAgent implements Agent {
  readonly name = "evaluation";
  readonly capabilities = ["outcome.evaluate", "evaluation", "timeline.rank"] as const;

  async execute(task: AgentTask): Promise<AgentResult> {
    const score =
      typeof task.input.score === "number"
        ? Math.max(0, Math.min(1, task.input.score))
        : 0.5;
    const confidence =
      typeof task.input.confidence === "number"
        ? Math.max(0, Math.min(1, task.input.confidence))
        : 0.5;

    return {
      ok: true,
      capability: task.capability,
      agent: this.name,
      data: {
        score,
        confidence,
        rationale: String(task.input.rationale ?? "Evaluation stub"),
        policyCompliant: task.input.policyCompliant !== false,
      },
    };
  }
}

export const evaluationAgent = new EvaluationAgent();
