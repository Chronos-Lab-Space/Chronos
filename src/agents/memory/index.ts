import { deriveProductLearning } from "../../domain/workspace/productLearning";
import {
  learningMemoryStore,
  type LearningMemoryStore,
} from "../../infrastructure/memory/LearningMemoryStore";
import type { Agent, AgentResult, AgentTask } from "../types";

function asRankedFutures(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const f = item as Record<string, unknown>;
      if (typeof f.id !== "string" || typeof f.name !== "string") return null;
      if (typeof f.score !== "number") return null;
      return {
        id: f.id,
        name: f.name,
        score: f.score,
        risk: typeof f.risk === "number" ? f.risk : undefined,
        expectedValue: typeof f.expectedValue === "number" ? f.expectedValue : undefined,
        rank: typeof f.rank === "number" ? f.rank : undefined,
      };
    })
    .filter((f): f is NonNullable<typeof f> => f !== null);
}

/**
 * Persists product learning derived from ranked decisions.
 * Default store: local LearningMemoryStore (durable in browser).
 */
export class MemoryAgent implements Agent {
  readonly name = "memory";
  readonly capabilities = ["memory.write", "memory"] as const;

  constructor(private readonly store: LearningMemoryStore = learningMemoryStore) {}

  async execute(task: AgentTask): Promise<AgentResult> {
    const record = (task.input.record ?? task.input) as Record<string, unknown>;
    const workspaceId = String(task.input.workspaceId ?? record.workspaceId ?? "").trim();
    const simulationId = String(record.simulationId ?? task.input.simulationId ?? "").trim();

    if (!workspaceId) {
      return {
        ok: false,
        capability: task.capability,
        agent: this.name,
        data: {},
        error: "memory.write requires workspaceId",
      };
    }

    const fromFutures = asRankedFutures(record.futures);
    const fromRanked = asRankedFutures(record.ranked);
    const fromTop =
      record.top && typeof record.top === "object" ? asRankedFutures([record.top]) : [];
    const futures =
      fromFutures.length > 0 ? fromFutures : fromRanked.length > 0 ? fromRanked : fromTop;

    const learning = deriveProductLearning({
      workspaceId,
      simulationId: simulationId || `sim-${Date.now()}`,
      recommendation: typeof record.recommendation === "string" ? record.recommendation : undefined,
      futures,
    });

    const written = this.store.append(workspaceId, learning.memories);
    const all = this.store.list(workspaceId);

    return {
      ok: true,
      capability: task.capability,
      agent: this.name,
      data: {
        written: written > 0,
        writtenCount: written,
        totalForWorkspace: all.length,
        learning: {
          successfulFuture: learning.successfulFuture,
          preferenceHints: learning.preferenceHints,
          memoryIds: learning.memories.map((m) => m.id),
        },
        summary: `Persisted ${written} learning record(s) for workspace ${workspaceId}`,
      },
    };
  }
}

export const memoryAgent = new MemoryAgent();
