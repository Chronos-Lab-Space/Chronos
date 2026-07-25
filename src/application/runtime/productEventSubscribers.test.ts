import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../infrastructure/analytics/productAnalytics", () => ({
  trackProductEvent: vi.fn(),
}));

import { trackProductEvent } from "../../infrastructure/analytics/productAnalytics";
import { eventBus } from "../../core/runtime";
import {
  registerProductEventSubscribers,
  resetProductEventSubscribersForTests,
} from "./productEventSubscribers";

describe("productEventSubscribers", () => {
  beforeEach(() => {
    resetProductEventSubscribersForTests();
    vi.mocked(trackProductEvent).mockClear();
    // Fresh bus handlers by re-registering on shared singleton is limited;
    // register once and assert call counts from cleared mock.
    registerProductEventSubscribers();
  });

  it("tracks simulation_started on SimulationStarted", async () => {
    await eventBus.publish("SimulationStarted", {
      simulationId: "s1",
      workspaceId: "w1",
      objectiveLength: 12,
      constraintCount: 2,
    });
    expect(trackProductEvent).toHaveBeenCalledWith(
      "simulation_started",
      expect.objectContaining({
        simulationId: "s1",
        workspaceId: "w1",
        source: "event_bus",
      })
    );
  });

  it("tracks simulation_completed on SimulationFinished", async () => {
    await eventBus.publish("SimulationFinished", {
      simulationId: "s1",
      workspaceId: "w1",
      confidence: 0.8,
      bestFuture: "Path A",
      futuresCount: 3,
      status: "completed",
    });
    expect(trackProductEvent).toHaveBeenCalledWith(
      "simulation_completed",
      expect.objectContaining({
        simulationId: "s1",
        bestFuture: "Path A",
        futures: 3,
        source: "event_bus",
      })
    );
  });

  it("writes memory and publishes MemoryUpdated on DecisionRanked", async () => {
    const memoryEvents: unknown[] = [];
    const unsub = eventBus.subscribe("MemoryUpdated", (e) => {
      memoryEvents.push(e.payload);
    });

    await eventBus.publish("DecisionRanked", {
      simulationId: "s1",
      recommendation: "Ship MVP",
      futures: [{ id: "f1", name: "MVP", score: 0.9 }],
    });

    // allow async memory agent
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));

    expect(memoryEvents.length).toBeGreaterThanOrEqual(1);
    expect(memoryEvents[0]).toEqual(
      expect.objectContaining({ simulationId: "s1", ok: true })
    );
    unsub();
  });
});
