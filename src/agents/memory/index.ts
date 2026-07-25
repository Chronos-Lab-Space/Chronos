import type { Agent, AgentResult, AgentTask } from "../types";

export class MemoryAgent implements Agent {
  readonly name = "memory";
  readonly capabilities = ["memory.write", "memory"] as const;

  async execute(task: AgentTask): Promise<AgentResult> {
    return {
      ok: true,
      capability: task.capability,
      agent: this.name,
      data: {
        written: false,
        record: task.input.record ?? null,
        summary: "Memory stub — persistence remains WorkspaceService responsibility",
      },
    };
  }
}

export const memoryAgent = new MemoryAgent();
