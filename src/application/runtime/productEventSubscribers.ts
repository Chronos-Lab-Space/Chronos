import { eventBus } from "../../core/runtime";
import { runtime } from "../../core/runtime";
import { trackProductEvent } from "../../infrastructure/analytics/productAnalytics";

let registered = false;

/**
 * Side effects for product events: analytics + memory agent.
 * Services publish; they do not call analytics/memory directly.
 */
export function registerProductEventSubscribers(): void {
  if (registered) return;
  registered = true;

  eventBus.subscribe("SimulationStarted", (event) => {
    const p = event.payload as {
      simulationId?: string;
      workspaceId?: string;
      rerun?: boolean;
      objectiveLength?: number;
      constraintCount?: number;
    };
    trackProductEvent("simulation_started", {
      simulationId: p.simulationId,
      workspaceId: p.workspaceId,
      rerun: p.rerun ?? false,
      objectiveLength: p.objectiveLength,
      constraintCount: p.constraintCount,
      source: "event_bus",
    });
  });

  eventBus.subscribe("SimulationFinished", (event) => {
    const p = event.payload as {
      simulationId?: string;
      workspaceId?: string;
      confidence?: number;
      bestFuture?: string;
      graphId?: string;
      status?: string;
      futuresCount?: number;
    };
    trackProductEvent("simulation_completed", {
      simulationId: p.simulationId,
      workspaceId: p.workspaceId,
      confidence: p.confidence,
      bestFuture: p.bestFuture,
      graphId: p.graphId,
      status: p.status,
      futures: p.futuresCount,
      source: "event_bus",
    });
  });

  eventBus.subscribe("DecisionRanked", (event) => {
    const p = event.payload as {
      simulationId?: string;
      recommendation?: string;
      futures?: readonly { id: string; name: string; score: number }[];
    };
    // Persist ranked decision signal via memory capability (stub-safe).
    void runtime
      .run("memory.write", {
        record: {
          kind: "decision_ranked",
          simulationId: p.simulationId,
          recommendation: p.recommendation,
          top: p.futures?.[0] ?? null,
          rankedCount: p.futures?.length ?? 0,
        },
      })
      .then((result) => {
        void eventBus.publish("MemoryUpdated", {
          simulationId: p.simulationId,
          ok: result.ok,
          agent: result.agent,
        });
      })
      .catch(() => {
        /* never block product path */
      });
  });
}

/** Test helper */
export function resetProductEventSubscribersForTests(): void {
  registered = false;
}
