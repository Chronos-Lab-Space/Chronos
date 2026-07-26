import { describe, expect, it } from "vitest";
import { MemorySimulationCache } from "../../infrastructure/cache";
import type { SimulationResult } from "../../domain/chronos/startup-sim";
import { createSimulationCacheKey } from "../../domain/chronos/simulation-cache";
import { StartupSimulationService } from "./StartupSimulationService";

const request = {
  prompt: "I want to build an AI meeting assistant",
  workspaceId: "workspace-demo",
  modelVersion: "startup-simulator-v1",
  configuration: { futureCount: 64, horizonMonths: 18, ranking: "expected-arr" },
};

describe("StartupSimulationService cache", () => {
  it("creates the same cache key regardless of configuration key order", () => {
    const first = createSimulationCacheKey(request);
    const second = createSimulationCacheKey({
      ...request,
      configuration: { ranking: "expected-arr", horizonMonths: 18, futureCount: 64 },
    });

    expect(second).toBe(first);
  });

  it("changes cache identity when prompt, workspace, model, or configuration changes", () => {
    const base = createSimulationCacheKey(request);
    expect(createSimulationCacheKey({ ...request, prompt: "A different startup" })).not.toBe(base);
    expect(createSimulationCacheKey({ ...request, workspaceId: "workspace-other" })).not.toBe(base);
    expect(createSimulationCacheKey({ ...request, modelVersion: "startup-simulator-v3" })).not.toBe(
      base
    );
    expect(createSimulationCacheKey({ ...request, configuration: { futureCount: 32 } })).not.toBe(
      base
    );
  });

  it("computes once and serves equivalent requests from cache", async () => {
    const cache = new MemorySimulationCache<SimulationResult>();
    const service = new StartupSimulationService(cache);

    const first = await service.run(request);
    const second = await service.run(request);

    expect(first.source).toBe("computed");
    expect(second.source).toBe("cache");
    expect(second.cacheKey).toBe(first.cacheKey);
    expect(second.result).toEqual(first.result);
  });
});
