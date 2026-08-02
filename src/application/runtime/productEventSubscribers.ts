import { eventBus } from "../../core/runtime";
import { runtime } from "../../core/runtime";
import type { ProductEventName } from "../../infrastructure/analytics/productAnalytics";

let registered = false;

/** Analytics sink — composition supplies trackProductEvent. */
export type ProductEventAnalytics = {
  track: (event: ProductEventName, props?: Record<string, unknown>) => void;
};

/**
 * Side effects for product events: analytics + memory agent.
 * Services publish; they do not call analytics/memory directly.
 * Analytics is injected so application/runtime does not import the adapter.
 */
export function registerProductEventSubscribers(analytics: ProductEventAnalytics): void {
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
    analytics.track("simulation_started", {
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
    analytics.track("simulation_completed", {
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
      workspaceId?: string;
      recommendation?: string;
      evaluationRationale?: string;
      edge?: number;
      futures?: readonly {
        id: string;
        name: string;
        score: number;
        risk?: number;
        expectedValue?: number;
        rank?: number;
      }[];
    };

    if (!p.workspaceId) {
      return;
    }

    // Persist ranked decision learning via MemoryAgent (durable local store).
    void runtime
      .run("memory.write", {
        workspaceId: p.workspaceId,
        record: {
          kind: "decision_ranked",
          workspaceId: p.workspaceId,
          simulationId: p.simulationId,
          recommendation: p.recommendation ?? p.evaluationRationale,
          futures: p.futures ?? [],
          edge: p.edge ?? null,
        },
      })
      .then((result) => {
        void eventBus.publish("MemoryUpdated", {
          simulationId: p.simulationId,
          workspaceId: p.workspaceId,
          ok: result.ok,
          written: result.data.written === true,
          writtenCount: result.data.writtenCount ?? 0,
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
