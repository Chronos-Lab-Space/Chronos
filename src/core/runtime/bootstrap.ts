import {
  codingAgent,
  evaluationAgent,
  executionAgent,
  knowledgeAgent,
  memoryAgent,
  researchAgent,
  simulationAgent,
} from "../../agents";
import { AgentRuntime, runtime } from "./runtime";

/** Register default specialist agents on a runtime instance. */
export function registerDefaultAgents(target: AgentRuntime = runtime): AgentRuntime {
  if (target.listAgents().length > 0) return target;

  target
    .register(researchAgent)
    .register(codingAgent)
    .register(simulationAgent)
    .register(memoryAgent)
    .register(knowledgeAgent)
    .register(evaluationAgent)
    .register(executionAgent);

  return target;
}

registerDefaultAgents(runtime);
