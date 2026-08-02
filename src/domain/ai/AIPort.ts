import type {
  CodeRequest,
  EmbedRequest,
  EmbedResult,
  GenerateRequest,
  GenerateResult,
  ReasonRequest,
  TaskGenerateRequest,
} from "./types";

/**
 * Provider-agnostic AI capability port.
 * Application/engines depend only on this interface.
 */
export interface AIPort {
  readonly id: string;
  generate(req: GenerateRequest): Promise<GenerateResult>;
  /**
   * Prefer for product call sites: task id + fields, host owns the prompt.
   * Adapters without a task-shaped transport build messages via `buildTaskMessages`.
   */
  generateTask(req: TaskGenerateRequest): Promise<GenerateResult>;
  embed(req: EmbedRequest): Promise<EmbedResult>;
  reason(req: ReasonRequest): Promise<GenerateResult>;
  code(req: CodeRequest): Promise<GenerateResult>;
}
