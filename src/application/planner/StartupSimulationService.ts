import type { SimulationResult } from "../../domain/chronos/startup-sim";
import { simulate } from "../../domain/chronos/startup-sim";
import {
  createSimulationCacheKey,
  isCacheEntryFresh,
  type SimulationCache,
  type SimulationCacheInput,
} from "../../domain/chronos/simulation-cache";

export type StartupSimulationRequest = SimulationCacheInput;

export type StartupSimulationResponse = {
  result: SimulationResult;
  cacheKey: string;
  source: "cache" | "computed";
};

/**
 * Application service for the public startup simulator. In production, pass a
 * server-side shared cache; in the browser, a session cache avoids duplicate
 * work while preserving prompt privacy.
 */
export class StartupSimulationService {
  constructor(private readonly cache: SimulationCache<SimulationResult>) {}

  async run(request: StartupSimulationRequest): Promise<StartupSimulationResponse> {
    const cacheKey = createSimulationCacheKey(request);
    const cached = await this.cache.get(cacheKey);

    if (cached && isCacheEntryFresh(cached)) {
      return { result: cached.value, cacheKey, source: "cache" };
    }

    const budgetRaw = request.configuration?.futureCount;
    const sampleBudget =
      typeof budgetRaw === "number" && Number.isFinite(budgetRaw) ? budgetRaw : undefined;
    const result = simulate(request.prompt, { sampleBudget });
    await this.cache.set({
      key: cacheKey,
      value: result,
      createdAt: new Date().toISOString(),
    });

    return { result, cacheKey, source: "computed" };
  }
}
