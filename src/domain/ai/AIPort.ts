import type {
  CodeRequest,
  EmbedRequest,
  EmbedResult,
  GenerateRequest,
  GenerateResult,
  ReasonRequest,
} from "./types";

/**
 * Provider-agnostic AI capability port.
 * Application/engines depend only on this interface.
 */
export interface AIPort {
  readonly id: string;
  generate(req: GenerateRequest): Promise<GenerateResult>;
  embed(req: EmbedRequest): Promise<EmbedResult>;
  reason(req: ReasonRequest): Promise<GenerateResult>;
  code(req: CodeRequest): Promise<GenerateResult>;
}
