import { simulate } from "../../domain/chronos/startup-sim";
import type {
  KnowledgeRecord,
  KnowledgeType,
  NoteRecord,
  SimulationRecord,
  WorkspaceGoalRecord,
  WorkspaceHome,
  WorkspaceRecord,
} from "../../domain/workspace/types";
import { LocalWorkspaceStore, localWorkspaceStore } from "../../infrastructure/repositories/LocalWorkspaceStore";

function nowIso() {
  return new Date().toISOString();
}

function id(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/**
 * Foundation service for the product success metric:
 * create workspace → define goal → upload context → run simulation → resume later.
 *
 * Persistence is local-first (localStorage keyed by owner) so resume always works
 * in the browser. Supabase tables can be layered on without changing this API.
 */
export class WorkspaceService {
  constructor(private readonly store: LocalWorkspaceStore = localWorkspaceStore) {}

  load(ownerId: string): WorkspaceHome | null {
    return this.store.get(ownerId);
  }

  createWorkspace(ownerId: string, name: string): WorkspaceHome {
    const trimmed = name.trim();
    if (!trimmed) throw new Error("Workspace name is required.");

    const workspace: WorkspaceRecord = {
      id: id("ws"),
      name: trimmed,
      owner_id: ownerId,
      created_at: nowIso(),
    };

    const home: WorkspaceHome = {
      workspace,
      goal: null,
      recentSimulations: [],
      knowledge: [],
      notes: [],
    };

    return this.store.save(ownerId, home);
  }

  setGoal(ownerId: string, title: string, description = ""): WorkspaceHome {
    const home = this.require(ownerId);
    const trimmed = title.trim();
    if (!trimmed) throw new Error("Goal title is required.");

    const timestamp = nowIso();
    const goal: WorkspaceGoalRecord = {
      id: home.goal?.id ?? id("goal"),
      workspace_id: home.workspace.id,
      title: trimmed,
      description: description.trim(),
      status: "active",
      created_at: home.goal?.created_at ?? timestamp,
      updated_at: timestamp,
    };

    return this.store.save(ownerId, { ...home, goal });
  }

  addKnowledge(
    ownerId: string,
    input: {
      type: KnowledgeType;
      title: string;
      content?: string;
      metadata?: Record<string, unknown>;
    }
  ): WorkspaceHome {
    const home = this.require(ownerId);
    const title = input.title.trim();
    if (!title) throw new Error("Knowledge title is required.");

    const record: KnowledgeRecord = {
      id: id("knowledge"),
      workspace_id: home.workspace.id,
      type: input.type,
      title,
      content: (input.content ?? "").trim(),
      metadata: input.metadata ?? {},
      created_at: nowIso(),
    };

    return this.store.save(ownerId, {
      ...home,
      knowledge: [record, ...home.knowledge],
    });
  }

  addNote(ownerId: string, title: string, content: string): WorkspaceHome {
    const home = this.require(ownerId);
    const trimmedTitle = title.trim();
    if (!trimmedTitle) throw new Error("Note title is required.");

    const timestamp = nowIso();
    const note: NoteRecord = {
      id: id("note"),
      workspace_id: home.workspace.id,
      title: trimmedTitle,
      content: content.trim(),
      created_at: timestamp,
      updated_at: timestamp,
    };

    return this.store.save(ownerId, {
      ...home,
      notes: [note, ...home.notes],
    });
  }

  /**
   * Runs a deterministic temporal simulation for an objective and appends it
   * to the workspace so the user can return to it later.
   */
  runSimulation(ownerId: string, objective: string): WorkspaceHome {
    const home = this.require(ownerId);
    const title = objective.trim();
    if (!title) throw new Error("Simulation objective is required.");

    const context = [
      home.goal?.title,
      home.goal?.description,
      ...home.knowledge.map((k) => `${k.type}: ${k.title}`),
      ...home.notes.map((n) => n.title),
    ]
      .filter(Boolean)
      .join("\n");

    const result = simulate([title, context].filter(Boolean).join("\n\n"));
    const sim: SimulationRecord = {
      id: id("sim"),
      workspace_id: home.workspace.id,
      goal_id: home.goal?.id ?? null,
      status: "completed",
      confidence: result.bestPath.probability,
      title,
      best_outcome: result.bestPath.name,
      futures_count: result.pathsEvaluated,
      created_at: nowIso(),
    };

    return this.store.save(ownerId, {
      ...home,
      recentSimulations: [sim, ...home.recentSimulations],
    });
  }

  private require(ownerId: string): WorkspaceHome {
    const home = this.store.get(ownerId);
    if (!home) throw new Error("Create a workspace first.");
    return home;
  }
}

export const workspaceService = new WorkspaceService();
