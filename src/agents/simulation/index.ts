import {
  simulationEngine,
  type SimulationEngineInput,
  type SimulationEngineOutput,
} from "../../application/simulation/SimulationEngine";
import type { Agent, AgentResult, AgentTask } from "../types";

function isSimulationInput(value: unknown): value is SimulationEngineInput {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.simulationId === "string" &&
    typeof v.workspaceId === "string" &&
    typeof v.objective === "string" &&
    Array.isArray(v.knowledge) &&
    Array.isArray(v.notes) &&
    Array.isArray(v.constraints)
  );
}

/**
 * Forwards full product simulation payloads to the existing SimulationEngine.
 * Engine internals are unchanged (Phase 1 bridge).
 */
export class SimulationAgent implements Agent {
  readonly name = "simulation";
  readonly capabilities = [
    "simulation.execute",
    "financial.simulate",
    "scenario.generate",
    "branch.generate",
    "market.estimate",
    "adoption.predict",
    "risk.analyze",
  ] as const;

  async execute(task: AgentTask): Promise<AgentResult> {
    const payload = task.input.simulation ?? task.input;
    if (isSimulationInput(payload)) {
      const output: SimulationEngineOutput = simulationEngine.run(payload);
      return {
        ok: true,
        capability: task.capability,
        agent: this.name,
        data: {
          engine: output as unknown as Record<string, unknown>,
          confidence: output.confidence,
          bestFuture: output.best.name,
        },
      };
    }

    return {
      ok: true,
      capability: task.capability,
      agent: this.name,
      data: {
        deferred: true,
        summary: `Simulation capability ${task.capability} acknowledged (no SimulationEngineInput)`,
        prompt: task.input.prompt ?? null,
      },
    };
  }
}

export const simulationAgent = new SimulationAgent();
