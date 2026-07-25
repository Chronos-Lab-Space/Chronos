import type { Agent, AgentResult, AgentTask } from "../types";

export class ExecutionAgent implements Agent {
  readonly name = "execution";
  readonly capabilities = ["execution", "plan"] as const;

  async execute(task: AgentTask): Promise<AgentResult> {
    return {
      ok: true,
      capability: task.capability,
      agent: this.name,
      data: {
        accepted: true,
        summary: `Execution stub for ${task.capability}`,
        input: task.input,
      },
    };
  }
}

export const executionAgent = new ExecutionAgent();
