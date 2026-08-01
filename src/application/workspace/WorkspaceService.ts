import type { SimulationConstraint, SimulationEngineOutput } from "../simulation/SimulationEngine";
import { planner } from "../../core/planner/planner";
import { eventBus, runtime } from "../../core/runtime";
import { attachDecisions, decisionIdForSimulation } from "../../domain/workspace/decision";
import { sanitizeWorkspaceHomeIds } from "../../domain/workspace/persistedIds";
import {
  deriveOutcomeLearning,
  type OutcomeSignal,
  selectWeightedPreferences,
} from "../../domain/workspace/outcomeLearning";
import {
  type LearningMemoryPort,
  noopLearningMemory,
} from "../../domain/workspace/productLearning";
import { snapshotKnowledgeUsed } from "../../domain/workspace/simulationReport";
import { archiveGoalIfChanged } from "../../domain/workspace/workspaceMemory";
import type {
  GoalRecord,
  KnowledgeRecord,
  KnowledgeType,
  NoteRecord,
  OutcomeFollowed,
  OutcomeVerdict,
  SimulationRecord,
  WorkspaceHome,
  WorkspaceRecord,
} from "../../domain/workspace/types";
import { hasLocalMemory, mergeWorkspaceHomes } from "../../domain/workspace/sync";

function engineOutputFromAgent(data: Record<string, unknown>): SimulationEngineOutput {
  const engine = data.engine;
  if (!engine || typeof engine !== "object") {
    throw new Error("Simulation agent returned no engine output.");
  }
  return engine as SimulationEngineOutput;
}

/**
 * Minimal local port: the five calls this service actually makes. Named as a
 * port rather than typed as `LocalWorkspaceStore` so nothing here depends on
 * the browser-storage adapter that happens to implement it.
 */
export type WorkspaceLocalStore = {
  get(ownerId: string, workspaceId?: string): WorkspaceHome | null;
  list(ownerId: string): WorkspaceRecord[];
  getActiveId(ownerId: string): string | null;
  setActiveId(ownerId: string, workspaceId: string): void;
  save(ownerId: string, home: WorkspaceHome): WorkspaceHome;
};

/** Minimal cloud port used for dual-write + sync (Supabase or test double). */
export type WorkspaceCloudStore = {
  list(ownerId: string): Promise<WorkspaceRecord[]>;
  load(ownerId: string, workspaceId?: string): Promise<WorkspaceHome | null>;
  save(home: WorkspaceHome): Promise<void>;
  deleteKnowledge?(knowledgeId: string): Promise<void>;
  deleteNote?(noteId: string): Promise<void>;
};

function nowIso() {
  return new Date().toISOString();
}

/** Always UUID — required by Supabase uuid columns. */
function uuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  // Fallback for non-crypto environments (tests)
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function emptyRelations(): Pick<WorkspaceHome, "futuresBySimulation" | "timelineBySimulation"> {
  return { futuresBySimulation: {}, timelineBySimulation: {} };
}

/**
 * Whole-workspace dual-writes grow with history; cap retained simulations so
 * localStorage quota and cloud upsert latency stay bounded during beta.
 * Oldest simulations (and their futures/timeline relations) fall off first.
 */
export const MAX_RETAINED_SIMULATIONS = 40;

export type WorkspaceServiceOptions = {
  /** Required: where data lives is never this service's assumption to make. */
  local: WorkspaceLocalStore;
  /** Pass null to disable remote (unit tests, anonymous visitors). */
  remote?: WorkspaceCloudStore | null;
  /** Where outcome learning is kept. Omitted means "remember nothing". */
  memory?: LearningMemoryPort;
};

/**
 * Workspace HQ service.
 * Dual-write: localStorage (instant resume) + Supabase (cloud persistence when online/auth'd).
 * Load merges remote + local memory; empty cloud is backfilled from local when present.
 */
export class WorkspaceService {
  private readonly local: WorkspaceLocalStore;
  private readonly remote: WorkspaceCloudStore | null;
  private readonly memory: LearningMemoryPort;
  /** Last cloud dual-write / load error (null when healthy). */
  private remoteError: string | null = null;

  /**
   * Every dependency is supplied, never reached for. The adapters — browser
   * storage, Supabase, the learning store, and the E2E decision about which
   * cloud store to use — are chosen in `composition/workspaceService.ts`.
   */
  constructor(options: WorkspaceServiceOptions) {
    this.local = options.local;
    this.remote = options.remote ?? null;
    this.memory = options.memory ?? noopLearningMemory;
  }

  /** Surface dual-write failures to the UI (local copy may still have succeeded). */
  getRemoteError(): string | null {
    return this.remoteError;
  }

  private setRemoteError(err: unknown | null) {
    if (!err) {
      this.remoteError = null;
      return;
    }
    const anyErr = err as { message?: string; code?: string; hint?: string };
    const parts = [
      anyErr.message || (err instanceof Error ? err.message : String(err)),
      anyErr.code ? `(${anyErr.code})` : null,
      anyErr.hint || null,
    ].filter(Boolean);
    this.remoteError = parts.join(" ");
  }

  async listWorkspaces(ownerId: string): Promise<WorkspaceRecord[]> {
    if (this.remote) {
      try {
        const remote = await this.remote.list(ownerId);
        if (remote.length) {
          this.setRemoteError(null);
          return remote;
        }
      } catch (err) {
        this.setRemoteError(err);
        console.warn("[workspace] Supabase list failed; using local store.", err);
      }
    }
    return this.local.list(ownerId);
  }

  async load(ownerId: string, workspaceId?: string): Promise<WorkspaceHome | null> {
    const preferredId = workspaceId ?? this.local.getActiveId(ownerId) ?? undefined;
    const local = this.local.get(ownerId, preferredId);

    if (this.remote) {
      try {
        const remote = await this.remote.load(ownerId, preferredId);
        if (remote) {
          // Merge so local-only sims/knowledge that never synced are not dropped.
          const merged = local
            ? this.normalize(mergeWorkspaceHomes(remote, local))
            : this.normalize(remote);
          this.local.save(ownerId, merged);
          // Best-effort write-through so merged local memory reaches the cloud.
          if (local) {
            try {
              await this.remote.save(merged);
              this.setRemoteError(null);
            } catch (err) {
              this.setRemoteError(err);
              console.warn("[workspace] Supabase merge save failed; local merged copy kept.", err);
            }
          } else {
            this.setRemoteError(null);
          }
          return merged;
        }

        // Cloud empty: backfill local workspace memory (first device → cloud).
        if (local && hasLocalMemory(local)) {
          const normalized = this.normalize(local);
          try {
            await this.remote.save(normalized);
            this.setRemoteError(null);
          } catch (err) {
            this.setRemoteError(err);
            console.warn("[workspace] Supabase backfill failed; local copy kept.", err);
          }
          return normalized;
        }
        this.setRemoteError(null);
      } catch (err) {
        this.setRemoteError(err);
        console.warn("[workspace] Supabase load failed; using local store.", err);
      }
    }

    return local ? this.normalize(local) : null;
  }

  async switchWorkspace(ownerId: string, workspaceId: string): Promise<WorkspaceHome> {
    this.local.setActiveId(ownerId, workspaceId);
    const home = await this.load(ownerId, workspaceId);
    if (!home) throw new Error("Workspace not found.");
    return home;
  }

  async createWorkspace(ownerId: string, name: string, description = ""): Promise<WorkspaceHome> {
    const trimmed = name.trim();
    if (!trimmed) throw new Error("Workspace name is required.");

    // Always create a fresh workspace (does not overwrite existing ones).
    const workspace: WorkspaceRecord = {
      id: uuid(),
      owner_id: ownerId,
      name: trimmed,
      description: description.trim(),
      created_at: nowIso(),
    };

    const home: WorkspaceHome = {
      workspace,
      goal: null,
      goalHistory: [],
      recentSimulations: [],
      decisions: [],
      knowledge: [],
      notes: [],
      ...emptyRelations(),
    };

    return this.persist(ownerId, home);
  }

  async setGoal(
    ownerId: string,
    title: string,
    description = "",
    priority = 1
  ): Promise<WorkspaceHome> {
    const home = await this.require(ownerId);
    const trimmed = title.trim();
    if (!trimmed) throw new Error("Goal title is required.");
    const desc = description.trim();

    const goalHistory = archiveGoalIfChanged(home.goal, trimmed, desc, home.goalHistory ?? []);

    // New objective identity when title changes; keep id when refining same goal.
    const titleChanged = Boolean(home.goal && home.goal.title !== trimmed);
    const goal: GoalRecord = {
      id: titleChanged || !home.goal ? uuid() : home.goal.id,
      workspace_id: home.workspace.id,
      title: trimmed,
      description: desc,
      status: "active",
      priority,
      created_at: titleChanged || !home.goal ? nowIso() : home.goal.created_at,
    };

    return this.persist(ownerId, { ...home, goal, goalHistory });
  }

  async addKnowledge(
    ownerId: string,
    input: {
      type: KnowledgeType;
      title: string;
      content?: string;
      metadata?: Record<string, unknown>;
    }
  ): Promise<WorkspaceHome> {
    const home = await this.require(ownerId);
    const title = input.title.trim();
    if (!title) throw new Error("Knowledge title is required.");

    const record: KnowledgeRecord = {
      id: uuid(),
      workspace_id: home.workspace.id,
      type: input.type,
      title,
      content: (input.content ?? "").trim(),
      metadata: input.metadata ?? {},
      created_at: nowIso(),
    };

    return this.persist(ownerId, {
      ...home,
      knowledge: [record, ...home.knowledge],
    });
  }

  async updateKnowledge(
    ownerId: string,
    knowledgeId: string,
    patch: {
      title?: string;
      content?: string;
      metadata?: Record<string, unknown>;
      type?: KnowledgeType;
    }
  ): Promise<WorkspaceHome> {
    const home = await this.require(ownerId);
    const existing = home.knowledge.find((k) => k.id === knowledgeId);
    if (!existing) throw new Error("Knowledge item not found.");

    const title = patch.title !== undefined ? patch.title.trim() : existing.title;
    if (!title) throw new Error("Knowledge title is required.");

    const updated: KnowledgeRecord = {
      ...existing,
      title,
      content: patch.content !== undefined ? patch.content.trim() : existing.content,
      metadata: patch.metadata !== undefined ? patch.metadata : existing.metadata,
      type: patch.type ?? existing.type,
    };

    return this.persist(ownerId, {
      ...home,
      knowledge: home.knowledge.map((k) => (k.id === knowledgeId ? updated : k)),
    });
  }

  async deleteKnowledge(ownerId: string, knowledgeId: string): Promise<WorkspaceHome> {
    const home = await this.require(ownerId);
    if (!home.knowledge.some((k) => k.id === knowledgeId)) {
      throw new Error("Knowledge item not found.");
    }
    if (this.remote?.deleteKnowledge) {
      try {
        await this.remote.deleteKnowledge(knowledgeId);
      } catch (err) {
        console.warn("[workspace] Supabase deleteKnowledge failed; local updated.", err);
      }
    }
    return this.persist(ownerId, {
      ...home,
      knowledge: home.knowledge.filter((k) => k.id !== knowledgeId),
    });
  }

  async addNote(ownerId: string, title: string, content: string): Promise<WorkspaceHome> {
    const home = await this.require(ownerId);
    const trimmedTitle = title.trim();
    if (!trimmedTitle) throw new Error("Note title is required.");

    const note: NoteRecord = {
      id: uuid(),
      workspace_id: home.workspace.id,
      title: trimmedTitle,
      content: content.trim(),
      created_at: nowIso(),
    };

    const knowledgeNote: KnowledgeRecord = {
      id: uuid(),
      workspace_id: home.workspace.id,
      type: "note",
      title: trimmedTitle,
      content: content.trim(),
      metadata: { note_id: note.id },
      created_at: note.created_at,
    };

    return this.persist(ownerId, {
      ...home,
      notes: [note, ...home.notes],
      knowledge: [knowledgeNote, ...home.knowledge],
    });
  }

  async deleteNote(ownerId: string, noteId: string): Promise<WorkspaceHome> {
    const home = await this.require(ownerId);
    if (!home.notes.some((n) => n.id === noteId)) {
      throw new Error("Note not found.");
    }
    if (this.remote?.deleteNote) {
      try {
        await this.remote.deleteNote(noteId);
      } catch (err) {
        console.warn("[workspace] Supabase deleteNote failed; local updated.", err);
      }
    }
    return this.persist(ownerId, {
      ...home,
      notes: home.notes.filter((n) => n.id !== noteId),
      // Drop mirrored knowledge rows linked to this note
      knowledge: home.knowledge.filter((k) => k.metadata?.note_id !== noteId),
    });
  }

  /**
   * Runs the Chronos simulation engine and saves persistent memory:
   * Workspace → Simulation (versioned) → Futures → Report
   */
  async runSimulation(
    ownerId: string,
    objective: string,
    constraintLines: string[] = [],
    options: { parentSimulationId?: string } = {}
  ): Promise<WorkspaceHome> {
    const home = await this.require(ownerId);
    const title = objective.trim();
    if (!title) throw new Error("Simulation objective is required.");

    const parent = options.parentSimulationId
      ? home.recentSimulations.find((s) => s.id === options.parentSimulationId)
      : undefined;

    const lineageId = parent?.lineage_id ?? uuid();
    const version = parent
      ? Math.max(
          0,
          ...home.recentSimulations
            .filter((s) => (s.lineage_id || s.id) === (parent.lineage_id || parent.id))
            .map((s) => s.version || 1)
        ) + 1
      : 1;

    const simId = uuid();
    // A re-branch answers the question its parent answered — same decision,
    // next version. A fresh objective opens a new one. Deriving the id from
    // the lineage rather than minting one keeps this identical to what the
    // backfill migration and `attachDecisions` compute for the same rows.
    //
    // The DecisionRecord itself is created by `attachDecisions` inside
    // normalize(), which runs on the persist below. That is deliberately the
    // only place a decision is constructed: a second constructor here would
    // be free to drift from it.
    const decisionId =
      parent?.decision_id ?? decisionIdForSimulation({ id: simId, lineage_id: lineageId });
    const createdAt = nowIso();
    const constraints = this.parseConstraints(
      constraintLines.length
        ? constraintLines
        : parent && Array.isArray(parent.result.constraints)
          ? (parent.result.constraints as string[]).map((c) => c.replace(/^(hard|soft):\s*/i, ""))
          : []
    );

    const running: SimulationRecord = {
      id: simId,
      workspace_id: home.workspace.id,
      goal_id: home.goal?.id ?? null,
      title: parent ? parent.title : title,
      status: "running",
      confidence: null,
      result: {
        tasks: [
          { id: "plan", title: "Understanding goal", status: "pending", phase: "plan" },
          {
            id: "generate",
            title: "Generating candidate futures",
            status: "pending",
            phase: "generate",
          },
          {
            id: "evaluate",
            title: "Evaluating trade-offs",
            status: "pending",
            phase: "evaluate",
          },
          { id: "rank", title: "Ranking outcomes", status: "pending", phase: "rank" },
          {
            id: "collapse",
            title: "Preparing decision report",
            status: "pending",
            phase: "collapse",
          },
        ],
        constraints: constraints.map((c) => c.text),
      },
      created_at: createdAt,
      version,
      lineage_id: lineageId,
      parent_simulation_id: parent?.id ?? null,
      decision_id: decisionId,
    };

    await this.persist(ownerId, {
      ...home,
      recentSimulations: [running, ...home.recentSimulations],
    });

    const objectiveForEngine = parent ? parent.title : title;
    await eventBus.publish("SimulationStarted", {
      simulationId: simId,
      workspaceId: home.workspace.id,
      rerun: Boolean(parent),
      objectiveLength: objectiveForEngine.length,
      constraintCount: constraints.length,
    });

    const knowledgeUsed = snapshotKnowledgeUsed(home.knowledge, home.notes);

    // Feed prior learning preferences into planner + soft constraints.
    // Weighted by each prior's real outcome: a run whose prediction missed no
    // longer steers the next one; proven priors rank first.
    const outcomeBySimulationId: Record<string, OutcomeSignal> = {};
    for (const past of home.recentSimulations) {
      outcomeBySimulationId[past.id] = {
        followed: past.result.outcome_followed ?? null,
        verdict: past.result.outcome_verdict ?? null,
      };
    }
    const learnedPreferences = selectWeightedPreferences(
      this.memory.list(home.workspace.id),
      outcomeBySimulationId,
      3
    );
    const learnedSoftConstraints = learnedPreferences.map((text, index) => ({
      id: `learn-pref-${index}`,
      text,
      kind: "soft" as const,
    }));
    const engineConstraints = [...constraints, ...learnedSoftConstraints];

    const engineInput = {
      simulationId: simId,
      workspaceId: home.workspace.id,
      goal: home.goal,
      objective: objectiveForEngine,
      knowledge: home.knowledge,
      notes: home.notes,
      constraints: engineConstraints,
    };

    // Product path: Planner → Agent Runtime → SimulationAgent → SimulationEngine
    try {
      return await this.executeSimulation({
        ownerId,
        home,
        simId,
        objectiveForEngine,
        engineInput,
        engineConstraints,
        constraints,
        knowledgeUsed,
        learnedPreferences,
        createdAt,
        version,
        lineageId,
        decisionId,
        parent: parent ?? null,
      });
    } catch (err) {
      // Never leave a phantom "running" record behind — locally or in the
      // cloud. Mark it failed (best-effort), then surface the original error.
      await this.markSimulationFailed(ownerId, simId, err);
      throw err;
    }
  }

  private async executeSimulation(args: {
    ownerId: string;
    home: WorkspaceHome;
    simId: string;
    objectiveForEngine: string;
    engineInput: {
      simulationId: string;
      workspaceId: string;
      goal: WorkspaceHome["goal"];
      objective: string;
      knowledge: WorkspaceHome["knowledge"];
      notes: WorkspaceHome["notes"];
      constraints: SimulationConstraint[];
    };
    engineConstraints: SimulationConstraint[];
    constraints: readonly SimulationConstraint[];
    knowledgeUsed: ReturnType<typeof snapshotKnowledgeUsed>;
    learnedPreferences: string[];
    createdAt: string;
    version: number;
    lineageId: string;
    decisionId: string;
    parent: SimulationRecord | null;
  }): Promise<WorkspaceHome> {
    const {
      ownerId,
      home,
      simId,
      objectiveForEngine,
      engineInput,
      engineConstraints,
      constraints,
      knowledgeUsed,
      learnedPreferences,
      createdAt,
      version,
      lineageId,
      decisionId,
      parent,
    } = args;

    const plan = await planner.createPlan({
      goal: objectiveForEngine,
      workspace: { id: home.workspace.id },
      context: {
        simulationId: simId,
        constraints: engineConstraints.map((c) => c.text),
        learnedPreferences,
      },
      decisionId: simId,
    });

    const agentResult = await runtime.run("simulation.execute", {
      simulation: engineInput,
    });

    if (!agentResult.ok) {
      throw new Error(agentResult.error ?? "Simulation runtime failed.");
    }

    // SimulationAgent already ran engine + AI recommendation enrich (fail-open).
    const output = engineOutputFromAgent(agentResult.data);

    const failed = output.tasks.some((t) => t.status === "failed");

    // Evaluation agent annotates the engine's ranking with expected value.
    // preserveOrder keeps ONE ranking across the product: what the user
    // sees (engine collapse order) is what DecisionRanked publishes and
    // what the learning memory records.
    const evaluation = await runtime.run("outcome.evaluate", {
      preserveOrder: true,
      futures: output.futures.map((f) => ({
        id: f.id,
        name: f.name,
        score: f.score,
        risk: f.risk,
        confidence: f.confidence,
        summary: f.summary,
      })),
    });

    const rankedFutures = Array.isArray(evaluation.data.ranked)
      ? (evaluation.data.ranked as Array<{
          id: string;
          name: string;
          score: number;
          risk?: number;
          expectedValue?: number;
          rank?: number;
        }>)
      : output.futures.map((f, index) => ({
          id: f.id,
          name: f.name,
          score: f.score,
          risk: f.risk,
          expectedValue: f.score,
          rank: index + 1,
        }));

    await eventBus.publish("SimulationFinished", {
      simulationId: simId,
      workspaceId: home.workspace.id,
      graphId: plan.id,
      plannerTasks: plan.tasks.map((t) => t.title),
      confidence: output.confidence,
      bestFuture: output.best.name,
      status: failed ? "failed" : "completed",
      futuresCount: output.futures.length,
    });

    await eventBus.publish("DecisionRanked", {
      simulationId: simId,
      workspaceId: home.workspace.id,
      recommendation: output.recommendation,
      recommendation_body: output.recommendationBody ?? null,
      evaluationRationale:
        typeof evaluation.data.rationale === "string" ? evaluation.data.rationale : undefined,
      edge: typeof evaluation.data.edge === "number" ? evaluation.data.edge : undefined,
      futures: rankedFutures,
    });
    const sim: SimulationRecord = {
      id: simId,
      workspace_id: home.workspace.id,
      goal_id: home.goal?.id ?? null,
      title: objectiveForEngine,
      status: failed ? "failed" : "completed",
      confidence: output.confidence,
      result: {
        best_future: output.best.name,
        futures_count: output.futures.length,
        category: output.category,
        thesis: output.thesis,
        recommendation: output.recommendation,
        recommendation_body: output.recommendationBody ?? null,
        risks: output.risks,
        tasks: output.tasks,
        constraints: constraints.map((c) => `${c.kind}: ${c.text}`),
        planner_tasks: output.plannerTaskTitles,
        report_saved_at: createdAt,
        knowledge_used: knowledgeUsed,
        goal_title: home.goal?.title ?? null,
        goal_description: home.goal?.description ?? null,
        paths_evaluated: output.pathsEvaluated,
        path_archetypes: output.pathArchetypes,
        disqualified_count: output.disqualifiedCount,
        // Decision graph MVP: open + peer branches (collapse happens on chooseBestPath)
        graph_shape: "open_branches",
        graph_active_node: "n0-open",
        graph_branch_ids: output.futures.map((f) => f.id),
      },
      created_at: createdAt,
      version,
      lineage_id: lineageId,
      parent_simulation_id: parent?.id ?? null,
      decision_id: decisionId,
    };

    const latestHome = await this.require(ownerId);
    return this.persist(ownerId, {
      ...latestHome,
      recentSimulations: latestHome.recentSimulations.map((s) => (s.id === simId ? sim : s)),
      futuresBySimulation: {
        ...latestHome.futuresBySimulation,
        [simId]: output.futures,
      },
      timelineBySimulation: {
        ...latestHome.timelineBySimulation,
        [simId]: output.timeline,
      },
    });
  }

  /**
   * Failure recovery: flip a stranded "running" record to "failed" so it can
   * never persist indefinitely (locally or in the cloud). Best-effort — the
   * original engine error is what callers surface.
   */
  private async markSimulationFailed(
    ownerId: string,
    simulationId: string,
    err: unknown
  ): Promise<void> {
    try {
      const home = await this.require(ownerId);
      const message = err instanceof Error ? err.message : "Simulation runtime failed.";
      let changed = false;
      const recentSimulations = home.recentSimulations.map((s) => {
        if (s.id !== simulationId || s.status !== "running") return s;
        changed = true;
        return {
          ...s,
          status: "failed" as const,
          result: {
            ...s.result,
            recommendation: `Simulation failed: ${message}`,
            tasks: (s.result.tasks ?? []).map((t) =>
              t.status === "completed" ? t : { ...t, status: "failed" as const }
            ),
          },
        };
      });
      if (changed) {
        await this.persist(ownerId, { ...home, recentSimulations });
      }
    } catch {
      // Recovery is best-effort; never mask the original failure.
    }
  }

  async rerunSimulation(
    ownerId: string,
    parentSimulationId: string,
    constraintLines?: string[]
  ): Promise<WorkspaceHome> {
    const home = await this.require(ownerId);
    const parent = home.recentSimulations.find((s) => s.id === parentSimulationId);
    if (!parent) throw new Error("Simulation not found in memory.");
    const lines =
      constraintLines ??
      (Array.isArray(parent.result.constraints)
        ? (parent.result.constraints as string[]).map((c) => c.replace(/^(hard|soft):\s*/i, ""))
        : []);
    return this.runSimulation(ownerId, parent.title, lines, { parentSimulationId });
  }

  /**
   * Decision-graph rollback: stand at N0 Open again and generate a new set of
   * peer branches (next lineage version). Prior branches stay in Memory.
   */
  async rebranchFromOpen(
    ownerId: string,
    parentSimulationId: string,
    constraintLines?: string[]
  ): Promise<WorkspaceHome> {
    const home = await this.require(ownerId);
    const parent = home.recentSimulations.find((s) => s.id === parentSimulationId);
    if (!parent) throw new Error("Simulation not found in memory.");
    // Mark parent so UI/history can show the graph op
    const stamped: SimulationRecord = {
      ...parent,
      result: {
        ...parent.result,
        graph_active_node: "n0-open",
        graph_last_op: "rollback_to_open",
      },
    };
    await this.persist(ownerId, {
      ...home,
      recentSimulations: home.recentSimulations.map((s) =>
        s.id === parentSimulationId ? stamped : s
      ),
    });
    const next = await this.rerunSimulation(ownerId, parentSimulationId, constraintLines);
    // Tag the new sim as a re-branch
    const head = next.recentSimulations[0];
    if (!head) return next;
    const tagged: SimulationRecord = {
      ...head,
      result: {
        ...head.result,
        graph_op: "rebranch_from_open",
        graph_from_simulation_id: parentSimulationId,
        graph_active_node: "n0-open",
      },
    };
    return this.persist(ownerId, {
      ...next,
      recentSimulations: next.recentSimulations.map((s) => (s.id === head.id ? tagged : s)),
    });
  }

  /**
   * Product loop close: user chooses a future path and saves the decision.
   * Persists chosen_future_* on the simulation and logs a decision note.
   * Graph: branch → collapse (N2).
   */
  async chooseBestPath(
    ownerId: string,
    simulationId: string,
    futureId: string
  ): Promise<WorkspaceHome> {
    const home = await this.require(ownerId);
    const sim = home.recentSimulations.find((s) => s.id === simulationId);
    if (!sim) throw new Error("Simulation not found.");
    const futures = home.futuresBySimulation[simulationId] ?? [];
    const future = futures.find((f) => f.id === futureId);
    if (!future) throw new Error("Future not found on this simulation.");

    const chosenAt = nowIso();
    const updatedSim: SimulationRecord = {
      ...sim,
      result: {
        ...sim.result,
        chosen_future_id: future.id,
        chosen_future_name: future.name,
        chosen_summary: future.summary,
        chosen_at: chosenAt,
        // Keep engine ranking; user choice is explicit
        best_future: future.name,
        // Decision graph: N1 → N2 collapse
        graph_shape: "collapsed",
        graph_op: "collapse",
        graph_active_node: "n2-collapsed",
        graph_collapsed_future_id: future.id,
      },
    };

    const decisionNote: NoteRecord = {
      id: uuid(),
      workspace_id: home.workspace.id,
      title: `Decision: ${future.name}`,
      content: [
        `# Chosen path`,
        ``,
        `**Simulation:** ${sim.title} (v${sim.version})`,
        `**Path:** ${future.name}`,
        `**Confidence:** ${(future.confidence * 100).toFixed(0)}%`,
        `**Risk:** ${(future.risk * 100).toFixed(0)}%`,
        ``,
        future.summary,
        ``,
        `Saved ${chosenAt}`,
      ].join("\n"),
      created_at: chosenAt,
    };

    return this.persist(ownerId, {
      ...home,
      recentSimulations: home.recentSimulations.map((s) =>
        s.id === simulationId ? updatedSim : s
      ),
      notes: [decisionNote, ...home.notes],
    });
  }

  /**
   * Store the execution plan for an already-chosen path.
   *
   * Deliberately separate from chooseBestPath: the plan is best-effort prose
   * from a capability that may be unconfigured or down, and a saved decision
   * must never depend on it. No steps → no write, so a failed plan leaves no
   * trace rather than an empty section.
   */
  async saveExecutionPlan(
    ownerId: string,
    simulationId: string,
    steps: readonly string[],
    source: "ai" | "stub"
  ): Promise<WorkspaceHome> {
    const home = await this.require(ownerId);
    if (steps.length === 0) return home;

    const sim = home.recentSimulations.find((s) => s.id === simulationId);
    if (!sim) throw new Error("Simulation not found.");

    const updatedSim: SimulationRecord = {
      ...sim,
      result: {
        ...sim.result,
        plan_steps: [...steps],
        plan_source: source,
        plan_at: nowIso(),
      },
    };

    return this.persist(ownerId, {
      ...home,
      recentSimulations: home.recentSimulations.map((s) =>
        s.id === simulationId ? updatedSim : s
      ),
    });
  }

  /**
   * Outcome tracking step 1 — Did you follow this recommendation?
   * Requires a saved path (chooseBestPath first).
   */
  async recordOutcomeFollowed(
    ownerId: string,
    simulationId: string,
    followed: OutcomeFollowed
  ): Promise<WorkspaceHome> {
    if (followed !== "yes" && followed !== "partially" && followed !== "no") {
      throw new Error("Followed must be yes, partially, or no.");
    }
    const home = await this.require(ownerId);
    const sim = home.recentSimulations.find((s) => s.id === simulationId);
    if (!sim) throw new Error("Simulation not found.");
    if (!sim.result.chosen_future_id) {
      throw new Error("Choose a path before recording outcome follow-through.");
    }

    const at = nowIso();
    const updatedSim: SimulationRecord = {
      ...sim,
      result: {
        ...sim.result,
        outcome_followed: followed,
        outcome_followed_at: at,
      },
    };

    // Observed reality becomes memory — this is what re-weights future priors.
    this.memory.append(
      home.workspace.id,
      deriveOutcomeLearning({
        workspaceId: home.workspace.id,
        simulationId: sim.id,
        followed,
        verdict: sim.result.outcome_verdict ?? null,
        pathName: sim.result.chosen_future_name ?? sim.result.best_future ?? null,
        now: at,
      })
    );

    const note: NoteRecord = {
      id: uuid(),
      workspace_id: home.workspace.id,
      title: `Outcome follow-through: ${followed}`,
      content: [
        `# Did you follow this recommendation?`,
        ``,
        `**Answer:** ${followed}`,
        `**Simulation:** ${sim.title} (v${sim.version})`,
        `**Path:** ${String(sim.result.chosen_future_name ?? "—")}`,
        ``,
        `Recorded ${at}`,
      ].join("\n"),
      created_at: at,
    };

    return this.persist(ownerId, {
      ...home,
      recentSimulations: home.recentSimulations.map((s) =>
        s.id === simulationId ? updatedSim : s
      ),
      notes: [note, ...home.notes],
    });
  }

  /**
   * Outcome tracking step 2 — How did it turn out?
   */
  async recordOutcomeResult(
    ownerId: string,
    simulationId: string,
    resultNote: string,
    verdict?: OutcomeVerdict | null
  ): Promise<WorkspaceHome> {
    const text = resultNote.trim();
    if (!text) throw new Error("Describe how it turned out.");
    const home = await this.require(ownerId);
    const sim = home.recentSimulations.find((s) => s.id === simulationId);
    if (!sim) throw new Error("Simulation not found.");
    if (!sim.result.chosen_future_id) {
      throw new Error("Choose a path before recording how it turned out.");
    }
    if (!sim.result.outcome_followed) {
      throw new Error("Record whether you followed the recommendation first.");
    }

    const at = nowIso();
    const updatedSim: SimulationRecord = {
      ...sim,
      result: {
        ...sim.result,
        outcome_result: text,
        outcome_result_at: at,
        ...(verdict ? { outcome_verdict: verdict } : {}),
      },
    };

    this.memory.append(
      home.workspace.id,
      deriveOutcomeLearning({
        workspaceId: home.workspace.id,
        simulationId: sim.id,
        followed: sim.result.outcome_followed ?? null,
        verdict: verdict ?? sim.result.outcome_verdict ?? null,
        resultNote: text,
        pathName: sim.result.chosen_future_name ?? sim.result.best_future ?? null,
        now: at,
      })
    );

    const note: NoteRecord = {
      id: uuid(),
      workspace_id: home.workspace.id,
      title: `Outcome: ${sim.title}`,
      content: [
        `# How did it turn out?`,
        ``,
        `**Simulation:** ${sim.title} (v${sim.version})`,
        `**Path:** ${String(sim.result.chosen_future_name ?? "—")}`,
        `**Followed:** ${String(sim.result.outcome_followed)}`,
        ``,
        text,
        ``,
        `Recorded ${at}`,
      ].join("\n"),
      created_at: at,
    };

    return this.persist(ownerId, {
      ...home,
      recentSimulations: home.recentSimulations.map((s) =>
        s.id === simulationId ? updatedSim : s
      ),
      notes: [note, ...home.notes],
    });
  }

  private parseConstraints(lines: string[]): SimulationConstraint[] {
    return lines
      .map((line) => line.trim())
      .filter(Boolean)
      .map((text, index) => ({
        id: `c-${index}`,
        text,
        kind: /^(must|hard|required|no |never)/i.test(text) ? ("hard" as const) : ("soft" as const),
      }));
  }

  private async require(ownerId: string): Promise<WorkspaceHome> {
    // Prefer local for require after mutations (already written); fall back to load
    const local = this.local.get(ownerId);
    if (local) return this.normalize(local);
    const loaded = await this.load(ownerId);
    if (!loaded) throw new Error("Create a workspace first.");
    return loaded;
  }

  private async persist(ownerId: string, home: WorkspaceHome): Promise<WorkspaceHome> {
    const normalized = this.normalize(home);
    this.local.save(ownerId, normalized);
    if (this.remote) {
      try {
        await this.remote.save(normalized);
        this.setRemoteError(null);
      } catch (err) {
        this.setRemoteError(err);
        console.warn("[workspace] Supabase save failed; local copy kept.", err);
      }
    }
    return normalized;
  }

  private normalize(home: WorkspaceHome): WorkspaceHome {
    // Repair legacy demo ids (0x…) so dual-write never hits Postgres 22P02.
    const repaired = sanitizeWorkspaceHomeIds({
      ...home,
      goalHistory: home.goalHistory ?? [],
      decisions: home.decisions ?? [],
      knowledge: home.knowledge ?? [],
      notes: home.notes ?? [],
      futuresBySimulation: home.futuresBySimulation ?? {},
      timelineBySimulation: home.timelineBySimulation ?? {},
      workspace: {
        ...home.workspace,
        description: home.workspace.description ?? "",
      },
    });
    const recentSimulations = (repaired.recentSimulations ?? [])
      .map((sim) => ({
        ...sim,
        version: sim.version ?? 1,
        lineage_id: sim.lineage_id || sim.id,
        parent_simulation_id: sim.parent_simulation_id ?? null,
        result: sim.result ?? {},
      }))
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, MAX_RETAINED_SIMULATIONS);

    // Prune relation maps to retained simulations (also drops orphans).
    const keptIds = new Set(recentSimulations.map((sim) => sim.id));
    const futuresBySimulation = Object.fromEntries(
      Object.entries(repaired.futuresBySimulation ?? {}).filter(([id]) => keptIds.has(id))
    );
    const timelineBySimulation = Object.fromEntries(
      Object.entries(repaired.timelineBySimulation ?? {}).filter(([id]) => keptIds.has(id))
    );

    // Last, and deliberately: it groups whatever survived retention, so a
    // decision is never left pointing at a version that has just been trimmed.
    return attachDecisions({
      ...repaired,
      recentSimulations,
      futuresBySimulation,
      timelineBySimulation,
    });
  }
}

/**
 * Both product singletons live in `composition/workspaceService.ts`, which is
 * also where `registerProductEventSubscribers()` runs. Constructing them here
 * is what made this file import four infrastructure modules and fire an
 * analytics side effect on import.
 */
