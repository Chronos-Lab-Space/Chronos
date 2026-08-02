/**
 * Task-shaped prompts for ai-generate.
 * Keep in lockstep with src/domain/ai/taskPrompts.ts (same task ids + fields).
 */

export type BuiltTaskMessages = {
  system: string;
  prompt: string;
  maxTokens: number;
};

const AI_TASK_KINDS = new Set(["sim.recommendation", "plan.steps", "research.findings"]);

function field(fields: Record<string, unknown>, key: string): string {
  const v = fields[key];
  return typeof v === "string" ? v.trim() : "";
}

export function isAITaskKind(value: unknown): value is string {
  return typeof value === "string" && AI_TASK_KINDS.has(value);
}

export function buildTaskMessages(input: {
  task: string;
  fields: Record<string, unknown>;
  maxTokens?: number;
}): BuiltTaskMessages | string {
  const maxTokens = input.maxTokens ?? 420;
  const f = input.fields ?? {};

  switch (input.task) {
    case "sim.recommendation": {
      const objective = field(f, "objective");
      const pathName = field(f, "pathName");
      if (!objective || !pathName) {
        return "sim.recommendation requires fields.objective and fields.pathName.";
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
      if (!objective) return "plan.steps requires fields.objective.";
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
      if (!objective) return "research.findings requires fields.objective.";
      return {
        system:
          "You research competitive and market context for a product decision. " +
          "Return 3–6 short bullet findings, one per line, starting with '- '. " +
          "No invented metrics or citations. No ranking of options.",
        prompt: `Research context for this decision:\n${objective}`,
        maxTokens: Math.min(maxTokens, 500),
      };
    }
    default:
      return `Unknown task "${input.task}".`;
  }
}
