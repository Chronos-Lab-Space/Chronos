/**
 * Composition root for the Agent OS capability registry singleton.
 *
 * `createDefaultCapabilityRegistry` is pure application: it takes an AIPort
 * and returns a registry. Env resolution lives here so application never
 * imports createAIPortFromEnv.
 */

import {
  createDefaultCapabilityRegistry,
  type DefaultCapabilityRegistryOptions,
} from "../application/agent-os/createDefaultCapabilityRegistry";
import type { CapabilityRegistry } from "../application/agent-os/AgentOperatingSystem";
import { createAIPortFromEnv } from "../infrastructure/ai/createAIPort";

let defaultRegistry: CapabilityRegistry | null = null;

/** Process-wide default for SPA / runtime composition. */
export function getDefaultCapabilityRegistry(): CapabilityRegistry {
  if (!defaultRegistry) {
    defaultRegistry = createDefaultCapabilityRegistry({
      ai: createAIPortFromEnv(),
    });
  }
  return defaultRegistry;
}

/** Test helper — drop the singleton. */
export function resetDefaultCapabilityRegistryForTests(): void {
  defaultRegistry = null;
}

/** Build a non-singleton registry (tests, alternate composition roots). */
export function buildCapabilityRegistry(
  options: DefaultCapabilityRegistryOptions = {}
): CapabilityRegistry {
  return createDefaultCapabilityRegistry(options);
}
