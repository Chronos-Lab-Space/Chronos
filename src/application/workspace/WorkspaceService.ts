import {
  simulationEngine,
  type SimulationConstraint,
} from "../simulation/SimulationEngine";
import { snapshotKnowledgeUsed } from "../../domain/workspace/simulationReport";
import { archiveGoalIfChanged } from "../../domain/workspace/workspaceMemory";
import type {
  GoalRecord,
  KnowledgeRecord,
  KnowledgeType,
  NoteRecord,
  OutcomeFollowed,
  SimulationRecord,
  WorkspaceHome,
  WorkspaceRecord,
} from "../../domain/workspace/types";
import { hasLocalMemory, mergeWorkspaceHomes } from "../../domain/workspace/sync";
import { isE2EAuthEnabled } from "../../infrastructure/auth/e2eAuth";
import {
  LocalWorkspaceStore,
  localWorkspaceStore,
} from "../../infrastructure/repositories/LocalWorkspaceStore";
import { supabaseWorkspaceRepository } from "../../infrastructure/repositories/SupabaseWorkspaceRepository";

/** Minimal cloud port used for dual-write + sync (Supabase or test double). */
export type WorkspaceCloudStore = {
  list(ownerId: string): Promise<WorkspaceRecord[]>;
  load(ownerId: string, workspaceId?: string): Promise<WorkspaceHome | null>;
  save(home: WorkspaceHome): Promise<void>;
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

export type WorkspaceServiceOptions = {
  local?: LocalWorkspaceStore;
  /** Pass null to disable remote (unit tests). */
  remote?: WorkspaceCloudStore | null;
};

/**
 * Workspace HQ service.
 * Dual-write: localStorage (instant resume) + Supabase (cloud persistence when online/auth'd).
 * Load merges remote + local memory; empty cloud is backfilled from local when present.
 */
export class WorkspaceService {
  private readonly local: LocalWorkspaceStore;
  private readonly remote: WorkspaceCloudStore | null;
  /** Last cloud dual-write / load error (null when healthy). */
  private remoteError: string | null = null;

  constructor(options: WorkspaceServiceOptions | LocalWorkspaceStore = {}) {
    // Back-compat: tests pass LocalWorkspaceStore directly
    if (options instanceof LocalWorkspaceStore) {
      this.local = options;
      this.remote = null;
    } else {
      this.local = options.local ?? localWorkspaceStore;
      // Playwright E2E uses local-only memory so placeholder Supabase cannot hang the loop.
      const defaultRemote = isE2EAuthEnabled()
        ? null
        : (supabaseWorkspaceRepository as WorkspaceCloudStore);
      this.remote = options.remote === undefined ? defaultRemote : options.remote;
    }
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

  async createWorkspace(
    ownerId: string,
    name: string,
    description = ""
  ): Promise<WorkspaceHome> {
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

    const goalHistory = archiveGoalIfChanged(
      home.goal,
      trimmed,
      desc,
      home.goalHistory ?? []
    );

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

    const title =
      patch.title !== undefined ? patch.title.trim() : existing.title;
    if (!title) throw new Error("Knowledge title is required.");

    const updated: KnowledgeRecord = {
      ...existing,
      title,
      content:
        patch.content !== undefined ? patch.content.trim() : existing.content,
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
    if (this.remote) {
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
    if (this.remote) {
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
          { id: "plan", title: "Planner", status: "pending", phase: "plan" },
          { id: "generate", title: "Generate futures", status: "pending", phase: "generate" },
          { id: "evaluate", title: "Evaluate", status: "pending", phase: "evaluate" },
          { id: "rank", title: "Rank", status: "pending", phase: "rank" },
          { id: "collapse", title: "Best future", status: "pending", phase: "collapse" },
        ],
        constraints: constraints.map((c) => c.text),
      },
      created_at: createdAt,
      version,
      lineage_id: lineageId,
      parent_simulation_id: parent?.id ?? null,
    };

    await this.persist(ownerId, {
      ...home,
      recentSimulations: [running, ...home.recentSimulations],
    });

    const objectiveForEngine = parent ? parent.title : title;
    const knowledgeUsed = snapshotKnowledgeUsed(home.knowledge, home.notes);

    const output = simulationEngine.run({
      simulationId: simId,
      workspaceId: home.workspace.id,
      goal: home.goal,
      objective: objectiveForEngine,
      knowledge: home.knowledge,
      notes: home.notes,
      constraints,
    });

    const failed = output.tasks.some((t) => t.status === "failed");
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
        risks: output.risks,
        tasks: output.tasks,
        constraints: constraints.map((c) => `${c.kind}: ${c.text}`),
        planner_tasks: output.plannerTaskTitles,
        report_saved_at: createdAt,
        knowledge_used: knowledgeUsed,
        goal_title: home.goal?.title ?? null,
        goal_description: home.goal?.description ?? null,
      },
      created_at: createdAt,
      version,
      lineage_id: lineageId,
      parent_simulation_id: parent?.id ?? null,
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
   * Product loop close: user chooses a future path and saves the decision.
   * Persists chosen_future_* on the simulation and logs a decision note.
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
    resultNote: string
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
      },
    };

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
    return {
      ...home,
      goalHistory: home.goalHistory ?? [],
      knowledge: home.knowledge ?? [],
      notes: home.notes ?? [],
      futuresBySimulation: home.futuresBySimulation ?? {},
      timelineBySimulation: home.timelineBySimulation ?? {},
      workspace: {
        ...home.workspace,
        description: home.workspace.description ?? "",
      },
      recentSimulations: (home.recentSimulations ?? []).map((sim) => ({
        ...sim,
        version: sim.version ?? 1,
        lineage_id: sim.lineage_id || sim.id,
        parent_simulation_id: sim.parent_simulation_id ?? null,
        result: sim.result ?? {},
      })),
    };
  }
}

export const workspaceService = new WorkspaceService();
