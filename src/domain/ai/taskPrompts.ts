/**
 * Task-shaped AI prompts — the function owns the prose shape.
 *
 * Client adapters that cannot use the hosted proxy (Ollama, tests) build the
 * same messages locally. The Edge Function must keep an identical switch for
 * `task` + `fields` so free-text relay can be retired. See SPEC-ai-proxy.md.
 */

import type { TaskGenerateRequest } from "./types";

export const AI_TASK_KINDS = ["sim.recommendation", "plan.steps", "research.findings"] as const;

export type BuiltTaskMessages = {
  system: string;
  prompt: string;
  maxTokens: number;
};

function field(fields: Record<string, string>, key: string): string {
  const v = fields[key];
  return typeof v === "string" ? v.trim() : "";
}

/**
 * Map an allowlisted task + fields → system/prompt. Unknown tasks throw;
 * the proxy should reject them with 400 before spend.
 */
export function buildTaskMessages(req: TaskGenerateRequest): BuiltTaskMessages {
  const maxTokens = req.maxTokens ?? 420;
  const f = req.fields ?? {};

  switch (req.task) {
    case "sim.recommendation": {
      const objective = field(f, "objective");
      const pathName = field(f, "pathName");
      if (!objective || !pathName) {
        throw new Error("sim.recommendation requires objective and pathName.");
      }
      return {
        system:
          "You write decision briefs for founders and PMs. No hype, no invented metrics. " +
          "Preserve the chosen path name. " +
          "Answer as exactly two blocks separated by one blank line. " +
          "First block: a single sentence stating the call. " +
          "Second block: 2–4 sentences on why this path beats the alternatives given " +
          "the evidence, what it costs, and the single next action.",
        prompt: [
          `Objective: ${objective}`,
          field(f, "goalTitle") ? `Goal: ${field(f, "goalTitle")}` : null,
          `Chosen path: ${pathName}`,
          field(f, "pathSummary") ? `Path summary: ${field(f, "pathSummary")}` : null,
          field(f, "deterministicRecommendation")
            ? `Deterministic recommendation: ${field(f, "deterministicRecommendation")}`
            : null,
          field(f, "deterministicThesis")
            ? `Deterministic thesis: ${field(f, "deterministicThesis")}`
            : null,
          field(f, "alternatives") ? `Alternatives considered: ${field(f, "alternatives")}` : null,
          field(f, "risks") ? `Risks: ${field(f, "risks")}` : null,
          field(f, "confidence") ? `Confidence: ${field(f, "confidence")}` : null,
          "",
          "Write the brief for this specific decision. Do not change the chosen path, the scores, or the confidence.",
        ]
          .filter(Boolean)
          .join("\n"),
        maxTokens: Math.min(maxTokens, 420),
      };
    }
    case "plan.steps": {
      const objective = field(f, "objective");
      if (!objective) throw new Error("plan.steps requires objective.");
      return {
        system:
          "You turn a product decision into a short execution plan. " +
          "Return 3–6 concrete steps, one per line, imperative mood. " +
          "No preamble, no invented metrics, no recommendation between options — " +
          "the path has already been chosen.",
        prompt: [
          `Execution plan for this objective:\n${objective}`,
          field(f, "researchContext")
            ? `\nResearch context (may be incomplete):\n${field(f, "researchContext")}`
            : null,
        ]
          .filter(Boolean)
          .join(""),
        maxTokens: Math.min(maxTokens, 400),
      };
    }
    case "research.findings": {
      const objective = field(f, "objective");
      if (!objective) throw new Error("research.findings requires objective.");
      return {
        system:
          "You research competitive and market context for a product decision. " +
          "Return 3–6 short bullet findings, one per line, starting with '- '. " +
          "No invented metrics or citations. No ranking of options.",
        prompt: `Research context for this decision:\n${objective}`,
        maxTokens: Math.min(maxTokens, 500),
      };
    }
    default: {
      const _exhaustive: never = req.task;
      throw new Error(`Unknown AI task: ${String(_exhaustive)}`);
    }
  }
}

export function isAITaskKind(value: unknown): value is TaskGenerateRequest["task"] {
  return typeof value === "string" && (AI_TASK_KINDS as readonly string[]).includes(value);
}
