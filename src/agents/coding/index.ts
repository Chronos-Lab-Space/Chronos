import type { Agent, AgentResult, AgentTask } from "../types";

export class CodingAgent implements Agent {
  readonly name = "coding";
  readonly capabilities = ["generate_code", "coding", "roadmap.build"] as const;

  async execute(task: AgentTask): Promise<AgentResult> {
    return {
      ok: true,
      capability: task.capability,
      agent: this.name,
      data: {
        artifacts: [],
        summary: `Coding stub for capability ${task.capability}`,
      },
    };
  }
}

export const codingAgent = new CodingAgent();
