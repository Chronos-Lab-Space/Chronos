import type { AIPort } from "../../domain/ai/AIPort";
import { NoopAIProvider } from "../../domain/ai/NoopAIProvider";
import type { Agent, AgentResult, AgentTask } from "../types";

function isNoop(ai: AIPort): boolean {
  return ai.id === "noop";
}

/** Strip list ordinals/bullets — array position already carries the order. */
function toSteps(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "").trim())
    .filter(Boolean)
    .slice(0, 8);
}

/**
 * Plan / execution capability.
 *
 * - Default / noop AIPort → structured stub (offline-safe, deterministic text).
 * - Configured AIPort → a short ordered plan for the objective.
 *
 * Emits prose and steps, never an ordering of futures: nothing here feeds
 * collapse order or DecisionRanked, so the engine keeps owning the ranking.
 * See SPEC-llm-capability.md.
 */
export class ExecutionAgent implements Agent {
  readonly name = "execution";
  readonly capabilities = ["execution", "plan"] as const;

  constructor(private readonly ai: AIPort = new NoopAIProvider()) {}

  async execute(task: AgentTask): Promise<AgentResult> {
    const objective = String(
      task.input.objective ?? task.input.goal ?? task.input.prompt ?? ""
    ).trim();

    if (!isNoop(this.ai) && objective) {
      try {
        const researchContext = String(task.input.researchContext ?? "").trim();
        const generated = await this.ai.generateTask({
          task: "plan.steps",
          fields: {
            objective,
            ...(researchContext ? { researchContext } : {}),
          },
          maxTokens: 400,
        });
        const text = generated.text?.trim() ?? "";
        const steps = text ? toSteps(text) : [];
        if (steps.length > 0) {
          return {
            ok: true,
            capability: task.capability,
            agent: this.name,
            data: {
              accepted: true,
              steps,
              summary: text,
              input: task.input,
              source: "ai",
              model: generated.model,
              provider: generated.provider,
            },
          };
        }
      } catch {
        // Fail open to stub — an upstream outage degrades the text, never the task.
      }
    }

    return {
      ok: true,
      capability: task.capability,
      agent: this.name,
      data: {
        accepted: true,
        steps: [],
        summary: `Execution stub for ${task.capability}`,
        input: task.input,
        source: "stub",
        model: "noop",
        provider: this.ai.id,
      },
    };
  }
}

export const executionAgent = new ExecutionAgent();
