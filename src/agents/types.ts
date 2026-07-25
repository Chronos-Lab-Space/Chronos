import type { Task, TaskKind } from "../domain/chronos/task-os";

export type AgentTask = {
  id: string;
  kind?: TaskKind | string;
  capability: string;
  title?: string;
  input: Record<string, unknown>;
  dependencies?: readonly string[];
};

export type AgentResult = {
  ok: boolean;
  capability: string;
  agent: string;
  data: Record<string, unknown>;
  error?: string;
};

export interface Agent {
  readonly name: string;
  readonly capabilities: readonly string[];
  execute(task: AgentTask): Promise<AgentResult>;
}

export function taskToAgentTask(task: Task): AgentTask {
  return {
    id: task.id,
    kind: task.kind,
    capability: task.capability,
    title: task.title,
    input: { ...task.input },
    dependencies: task.dependencies,
  };
}

export function supportsCapability(agent: Agent, capability: string): boolean {
  return agent.capabilities.includes(capability);
}
