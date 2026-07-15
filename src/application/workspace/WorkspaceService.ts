import {
  simulationEngine,
  type SimulationConstraint,
} from "../simulation/SimulationEngine";
import type {
  GoalRecord,
  KnowledgeRecord,
  KnowledgeType,
  NoteRecord,
  SimulationRecord,
  WorkspaceHome,
  WorkspaceRecord,
} from "../../domain/workspace/types";
import {
  LocalWorkspaceStore,
  localWorkspaceStore,
} from "../../infrastructure/repositories/LocalWorkspaceStore";
import {
  SupabaseWorkspaceRepository,
  supabaseWorkspaceRepository,
} from "../../infrastructure/repositories/SupabaseWorkspaceRepository";

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
  remote?: SupabaseWorkspaceRepository | null;
};

/**
 * Workspace HQ service.
 * Dual-write: localStorage (instant resume) + Supabase (cloud persistence when online/auth'd).
 * Load prefers Supabase, falls back to local.
 */
export class WorkspaceService {
  private readonly local: LocalWorkspaceStore;
  private readonly remote: SupabaseWorkspaceRepository | null;

  constructor(options: WorkspaceServiceOptions | LocalWorkspaceStore = {}) {
    // Back-compat: tests pass LocalWorkspaceStore directly
    if (options instanceof LocalWorkspaceStore) {
      this.local = options;
      this.remote = null;
    } else {
      this.local = options.local ?? localWorkspaceStore;
      this.remote =
        options.remote === undefined ? supabaseWorkspaceRepository : options.remote;
    }
  }

  async listWorkspaces(ownerId: string): Promise<WorkspaceRecord[]> {
    if (this.remote) {
      try {
        const remote = await this.remote.list(ownerId);
        if (remote.length) return remote;
      } catch (err) {
        console.warn("[workspace] Supabase list failed; using local store.", err);
      }
    }
    return this.local.list(ownerId);
  }

  async load(ownerId: string, workspaceId?: string): Promise<WorkspaceHome | null> {
    const preferredId = workspaceId ?? this.local.getActiveId(ownerId) ?? undefined;
    if (this.remote) {
      try {
        const remote = await this.remote.load(ownerId, preferredId);
        if (remote) {
          this.local.save(ownerId, remote);
          return this.normalize(remote);
        }
      } catch (err) {
        console.warn("[workspace] Supabase load failed; using local store.", err);
      }
    }
    const local = this.local.get(ownerId, preferredId);
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

    const goal: GoalRecord = {
      id: home.goal?.id ?? uuid(),
      workspace_id: home.workspace.id,
      title: trimmed,
      description: description.trim(),
      status: "active",
      priority,
      created_at: home.goal?.created_at ?? nowIso(),
    };

    return this.persist(ownerId, { ...home, goal });
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
      } catch (err) {
        console.warn("[workspace] Supabase save failed; local copy kept.", err);
      }
    }
    return normalized;
  }

  private normalize(home: WorkspaceHome): WorkspaceHome {
    return {
      ...home,
      futuresBySimulation: home.futuresBySimulation ?? {},
      timelineBySimulation: home.timelineBySimulation ?? {},
      workspace: {
        description: "",
        ...home.workspace,
      },
      recentSimulations: home.recentSimulations.map((sim) => ({
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
