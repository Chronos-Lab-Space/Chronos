/**
 * Platform AI capability contracts.
 * Engines depend on these types — never on a vendor SDK.
 */

export type GenerateRequest = {
  prompt: string;
  system?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
};

/**
 * Task-shaped generation — the host owns the prompt text.
 * Prefer this over free-text `generate` for any production call site.
 * See SPEC-ai-proxy.md later slice.
 */
export type AITaskKind = "sim.recommendation" | "plan.steps" | "research.findings";

export type TaskGenerateRequest = {
  task: AITaskKind;
  /** Allowlisted string fields for the task template. */
  fields: Record<string, string>;
  maxTokens?: number;
};

export type GenerateResult = {
  text: string;
  model: string;
  provider: string;
  usage?: { promptTokens?: number; completionTokens?: number };
};

export type EmbedRequest = {
  input: string | string[];
  model?: string;
};

export type EmbedResult = {
  vectors: number[][];
  model: string;
  provider: string;
};

export type ReasonRequest = GenerateRequest & {
  /** Optional hint for structured reasoning (adapter may ignore). */
  schemaHint?: string;
};

export type CodeRequest = GenerateRequest & {
  language?: string;
};

export type AICapability = "generate" | "embed" | "reason" | "code";
