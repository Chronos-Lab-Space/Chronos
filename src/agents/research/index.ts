import type { Agent, AgentResult, AgentTask } from "../types";

export class ResearchAgent implements Agent {
  readonly name = "research";
  readonly capabilities = ["research.competitors", "research"] as const;

  async execute(task: AgentTask): Promise<AgentResult> {
    const prompt = String(task.input.prompt ?? task.input.goal ?? "");
    return {
      ok: true,
      capability: task.capability,
      agent: this.name,
      data: {
        findings: [],
        summary: prompt
          ? `Research stub for: ${prompt.slice(0, 200)}`
          : "Research stub — no prompt provided",
        sources: [],
      },
    };
  }
}

export const researchAgent = new ResearchAgent();
