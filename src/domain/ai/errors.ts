import type { AICapability } from "./types";

/** Capability not supported by the selected adapter. */
export class AICapabilityError extends Error {
  readonly capability: AICapability;
  readonly provider: string;

  constructor(provider: string, capability: AICapability, message?: string) {
    super(message ?? `${provider} does not support capability: ${capability}`);
    this.name = "AICapabilityError";
    this.provider = provider;
    this.capability = capability;
  }
}

/** Transport / upstream provider failure. */
export class AIProviderError extends Error {
  readonly provider: string;
  readonly status?: number;

  constructor(provider: string, message: string, status?: number) {
    super(message);
    this.name = "AIProviderError";
    this.provider = provider;
    this.status = status;
  }
}
