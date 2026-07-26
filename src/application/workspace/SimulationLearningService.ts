import {
  KnowledgeGraph,
  Memory as ChronosMemory,
  type Simulation,
} from "../../domain/chronos/entities";

export type SuccessfulFuture = {
  branchId: string;
  hypothesis: string;
  score: number;
  evidence: string;
};

export type FailurePattern = {
  id: string;
  pattern: string;
  occurrences: number;
  recommendedConstraint: string;
};

export type WorkspaceLearningSnapshot = {
  workspaceId: string;
  pastSimulations: readonly {
    simulationId: string;
    status: string;
    winningBranchId?: string;
  }[];
  successfulFutures: readonly SuccessfulFuture[];
  failurePatterns: readonly FailurePattern[];
  memories: readonly ChronosMemory[];
  knowledgeGraph: KnowledgeGraph;
};

/**
 * Converts completed simulations into evidence that the next planning cycle
 * can consume. The derivation is deterministic: storage is an adapter concern,
 * not part of learning logic.
 */
export class SimulationLearningService {
  derive(
    simulation: Simulation,
    options: { workspaceId: string; now?: string }
  ): WorkspaceLearningSnapshot {
    const now = options.now ?? new Date().toISOString();
    const winner = simulation.winner;
    const pruned = simulation.branches.filter((branch) => branch.status === "pruned");

    const successfulFutures: SuccessfulFuture[] = winner
      ? [
          {
            branchId: winner.id,
            hypothesis: winner.hypothesis.name,
            score: winner.score ?? 0,
            evidence: winner.reason ?? "Selected by timeline ranking.",
          },
        ]
      : [];

    const patternCounts = new Map<string, number>();
    for (const branch of pruned) {
      for (const reason of (branch.reason ?? "unranked").split(" · ")) {
        patternCounts.set(reason, (patternCounts.get(reason) ?? 0) + 1);
      }
    }

    const failurePatterns = [...patternCounts.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([pattern, occurrences]) => ({
        id: `failure-${simulation.id}-${slug(pattern)}`,
        pattern,
        occurrences,
        recommendedConstraint: `Avoid plans exhibiting ${pattern}.`,
      }));

    const memories: ChronosMemory[] = [
      ...successfulFutures.map(
        (future) =>
          new ChronosMemory({
            id: `memory-success-${simulation.id}-${future.branchId}`,
            agentId: simulation.decision.agentId ?? "workspace-runtime",
            kind: "outcome",
            content: `Successful future: ${future.hypothesis} (score ${future.score.toFixed(3)}).`,
            metadata: {
              simulationId: simulation.id,
              branchId: future.branchId,
              evidence: future.evidence,
            },
            createdAt: now,
          })
      ),
      ...failurePatterns.map(
        (pattern) =>
          new ChronosMemory({
            id: `memory-failure-${simulation.id}-${slug(pattern.pattern)}`,
            agentId: simulation.decision.agentId ?? "workspace-runtime",
            kind: "preference",
            content: pattern.recommendedConstraint,
            metadata: { simulationId: simulation.id, occurrences: pattern.occurrences },
            createdAt: now,
          })
      ),
    ];

    const graph = new KnowledgeGraph({
      id: `graph-${options.workspaceId}`,
      workspaceId: options.workspaceId,
      nodes: [
        { id: simulation.id, type: "simulation", phase: simulation.phase },
        ...successfulFutures.map((future) => ({
          id: future.branchId,
          type: "successful_future",
          score: future.score,
        })),
        ...failurePatterns.map((pattern) => ({
          id: pattern.id,
          type: "failure_pattern",
          occurrences: pattern.occurrences,
        })),
      ],
      edges: [
        ...successfulFutures.map((future) => ({
          from: simulation.id,
          to: future.branchId,
          relation: "supports" as const,
          confidence: future.score,
        })),
        ...failurePatterns.map((pattern) => ({
          from: simulation.id,
          to: pattern.id,
          relation: "repeats" as const,
          confidence: Math.min(1, pattern.occurrences / Math.max(1, pruned.length)),
        })),
      ],
      updatedAt: now,
    });

    return {
      workspaceId: options.workspaceId,
      pastSimulations: [
        {
          simulationId: simulation.id,
          status: simulation.status,
          winningBranchId: winner?.id,
        },
      ],
      successfulFutures,
      failurePatterns,
      memories,
      knowledgeGraph: graph,
    };
  }
}

function slug(value: string) {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "unknown"
  );
}
