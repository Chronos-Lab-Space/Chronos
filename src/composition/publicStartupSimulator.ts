/**
 * Composition root for the public marketing /simulate service.
 *
 * Application owns StartupSimulationService + the request factory; this file
 * names the cache adapter and exports the product singleton.
 */

import { createPublicStartupRequest } from "../application/planner/createPublicStartupRequest";
import { StartupSimulationService } from "../application/planner/StartupSimulationService";
import type { SimulationResult } from "../domain/chronos/startup-sim";
import { MemorySimulationCache } from "../infrastructure/cache";

export { createPublicStartupRequest };

/**
 * Shared browser-level simulator service. Reusing one cache means the landing
 * demo and full simulator return the same cached result for identical inputs.
 */
export const publicStartupSimulator = new StartupSimulationService(
  new MemorySimulationCache<SimulationResult>()
);
