import type { AIPort } from "../../domain/ai/AIPort";
import { NoopAIProvider } from "../../domain/ai/NoopAIProvider";
import type { Agent, AgentResult, AgentTask } from "../types";

function isNoop(ai: AIPort): boolean {
  return ai.id === "noop";
}

/**
 * Research specialist.
 *
 * - Default / noop AIPort → structured stub (offline-safe, deterministic text).
 * - Configured AIPort (ollama / proxy) → generate a short research summary;
 *   fail-open to the stub on empty text or any error.
 *
 * Never invents scores or futures — prose/findings only.
 */
export class ResearchAgent implements Agent {
  readonly name = "research";
  readonly capabilities = ["research.competitors", "research"] as const;

  constructor(private readonly ai: AIPort = new NoopAIProvider()) {}

  async execute(task: AgentTask): Promise<AgentResult> {
    const prompt = String(
      task.input.prompt ?? task.input.goal ?? task.input.objective ?? ""
    ).trim();
    const stubSummary = prompt
      ? `Research stub for: ${prompt.slice(0, 200)}`
      : "Research stub — no prompt provided";

    if (!isNoop(this.ai) && prompt) {
      try {
        const generated = await this.ai.generateTask({
          task: "research.findings",
          fields: { objective: prompt },
          maxTokens: 400,
        });
        const text = generated.text?.trim() ?? "";
        if (text) {
          return {
            ok: true,
            capability: task.capability,
            agent: this.name,
            data: {
              findings: text
                .split("\n")
                .map((line) => line.replace(/^[-*•]\s*/, "").trim())
                .filter(Boolean)
                .slice(0, 8),
              summary: text,
              sources: [],
              source: "ai",
              model: generated.model,
              provider: generated.provider,
            },
          };
        }
      } catch {
        // Fail open to stub — same product contract as sim enrich.
      }
    }

    return {
      ok: true,
      capability: task.capability,
      agent: this.name,
      data: {
        findings: [],
        summary: stubSummary,
        sources: [],
        source: "stub",
        model: "noop",
        provider: this.ai.id,
      },
    };
  }
}

/** Shared singleton — noop AI (deterministic). Prefer `new ResearchAgent(ai)` when AI is configured. */
export const researchAgent = new ResearchAgent();
