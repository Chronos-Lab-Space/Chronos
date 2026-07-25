import type { Agent, AgentResult, AgentTask } from "../types";

export class KnowledgeAgent implements Agent {
  readonly name = "knowledge";
  readonly capabilities = ["knowledge", "knowledge.retrieve"] as const;

  async execute(task: AgentTask): Promise<AgentResult> {
    const knowledge = Array.isArray(task.input.knowledge) ? task.input.knowledge : [];
    return {
      ok: true,
      capability: task.capability,
      agent: this.name,
      data: {
        items: knowledge,
        count: knowledge.length,
        summary: `Knowledge stub with ${knowledge.length} items in context`,
      },
    };
  }
}

export const knowledgeAgent = new KnowledgeAgent();
