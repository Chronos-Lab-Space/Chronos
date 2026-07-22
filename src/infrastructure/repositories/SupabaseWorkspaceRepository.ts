import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  FutureRecord,
  GoalRecord,
  KnowledgeRecord,
  NoteRecord,
  SimulationRecord,
  TimelineNodeRecord,
  WorkspaceHome,
  WorkspaceRecord,
} from "../../domain/workspace/types";
import { supabase } from "../supabase/client";

/**
 * Supabase read/write for the Workspace product model.
 * Tables: workspaces, goals, simulations, futures, knowledge, notes, timeline_nodes
 */
export class SupabaseWorkspaceRepository {
  constructor(private readonly client: SupabaseClient = supabase) {}

  async list(ownerId: string): Promise<WorkspaceRecord[]> {
    const { data, error } = await this.client
      .from("workspaces")
      .select("*")
      .eq("owner_id", ownerId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map(mapWorkspace);
  }

  async load(ownerId: string, workspaceId?: string): Promise<WorkspaceHome | null> {
    let query = this.client
      .from("workspaces")
      .select("*")
      .eq("owner_id", ownerId)
      .order("created_at", { ascending: false })
      .limit(1);

    if (workspaceId) {
      query = this.client
        .from("workspaces")
        .select("*")
        .eq("owner_id", ownerId)
        .eq("id", workspaceId)
        .limit(1);
    }

    const { data: workspaces, error: wsError } = await query;

    if (wsError) throw wsError;
    const wsRow = workspaces?.[0];
    if (!wsRow) return null;

    const workspace = mapWorkspace(wsRow);
    const workspaceIdResolved = workspace.id;

    const [goalRes, simRes, knowledgeRes, notesRes] = await Promise.all([
      this.client
        .from("goals")
        .select("*")
        .eq("workspace_id", workspaceIdResolved)
        .eq("status", "active")
        .order("priority", { ascending: false })
        .limit(1),
      this.client
        .from("simulations")
        .select("*")
        .eq("workspace_id", workspaceIdResolved)
        .order("created_at", { ascending: false })
        .limit(50),
      this.client
        .from("knowledge")
        .select("*")
        .eq("workspace_id", workspaceIdResolved)
        .order("created_at", { ascending: false })
        .limit(200),
      this.client
        .from("notes")
        .select("*")
        .eq("workspace_id", workspaceIdResolved)
        .order("created_at", { ascending: false })
        .limit(200),
    ]);

    if (goalRes.error) throw goalRes.error;
    if (simRes.error) throw simRes.error;
    if (knowledgeRes.error) throw knowledgeRes.error;
    if (notesRes.error) throw notesRes.error;

    const simulations = (simRes.data ?? []).map(mapSimulation);
    const simIds = simulations.map((s) => s.id);

    let futuresBySimulation: Record<string, FutureRecord[]> = {};
    let timelineBySimulation: Record<string, TimelineNodeRecord[]> = {};

    if (simIds.length > 0) {
      const [futuresRes, nodesRes] = await Promise.all([
        this.client.from("futures").select("*").in("simulation_id", simIds),
        this.client.from("timeline_nodes").select("*").in("simulation_id", simIds),
      ]);
      if (futuresRes.error) throw futuresRes.error;
      if (nodesRes.error) throw nodesRes.error;

      for (const row of futuresRes.data ?? []) {
        const f = mapFuture(row);
        (futuresBySimulation[f.simulation_id] ??= []).push(f);
      }
      for (const row of nodesRes.data ?? []) {
        const n = mapTimelineNode(row);
        (timelineBySimulation[n.simulation_id] ??= []).push(n);
      }
      // Keep futures ranked by score desc
      for (const key of Object.keys(futuresBySimulation)) {
        futuresBySimulation[key].sort((a, b) => b.score - a.score);
      }
    }

    return {
      workspace,
      goal: goalRes.data?.[0] ? mapGoal(goalRes.data[0]) : null,
      goalHistory: [],
      recentSimulations: simulations,
      knowledge: (knowledgeRes.data ?? []).map(mapKnowledge),
      notes: (notesRes.data ?? []).map(mapNote),
      futuresBySimulation,
      timelineBySimulation,
    };
  }

  async save(home: WorkspaceHome): Promise<void> {
    const w = home.workspace;

    const { error: wsError } = await this.client.from("workspaces").upsert({
      id: w.id,
      owner_id: w.owner_id,
      name: w.name,
      description: w.description ?? "",
      created_at: w.created_at,
    });
    if (wsError) throw wsError;

    if (home.goal) {
      // Ensure only this goal is active for the workspace
      await this.client
        .from("goals")
        .update({ status: "paused" })
        .eq("workspace_id", w.id)
        .eq("status", "active")
        .neq("id", home.goal.id);

      const g = home.goal;
      const { error: goalError } = await this.client.from("goals").upsert({
        id: g.id,
        workspace_id: g.workspace_id,
        title: g.title,
        description: g.description ?? "",
        status: g.status,
        priority: g.priority ?? 0,
        created_at: g.created_at,
      });
      if (goalError) throw goalError;
    }

    if (home.knowledge.length > 0) {
      const { error } = await this.client.from("knowledge").upsert(
        home.knowledge.map((k) => ({
          id: k.id,
          workspace_id: k.workspace_id,
          type: k.type,
          title: k.title,
          content: k.content ?? "",
          metadata: k.metadata ?? {},
          created_at: k.created_at,
        }))
      );
      if (error) throw error;
    }

    if (home.notes.length > 0) {
      const { error } = await this.client.from("notes").upsert(
        home.notes.map((n) => ({
          id: n.id,
          workspace_id: n.workspace_id,
          title: n.title,
          content: n.content ?? "",
          created_at: n.created_at,
        }))
      );
      if (error) throw error;
    }

    if (home.recentSimulations.length > 0) {
      const { error } = await this.client.from("simulations").upsert(
        home.recentSimulations.map((s) => ({
          id: s.id,
          workspace_id: s.workspace_id,
          goal_id: s.goal_id,
          title: s.title,
          status: s.status,
          confidence: s.confidence,
          result: s.result ?? {},
          created_at: s.created_at,
          version: s.version ?? 1,
          lineage_id: s.lineage_id ?? s.id,
          parent_simulation_id: s.parent_simulation_id,
        }))
      );
      if (error) throw error;
    }

    // Futures + timeline: upsert by id (safer than delete-all under concurrent tabs)
    for (const sim of home.recentSimulations) {
      const futures = home.futuresBySimulation[sim.id] ?? [];
      const nodes = home.timelineBySimulation[sim.id] ?? [];

      if (futures.length > 0) {
        const { error } = await this.client.from("futures").upsert(
          futures.map((f) => ({
            id: f.id,
            simulation_id: f.simulation_id,
            name: f.name,
            score: f.score,
            risk: f.risk,
            confidence: f.confidence,
            summary: f.summary ?? "",
          })),
          { onConflict: "id" }
        );
        if (error) throw error;
      }

      if (nodes.length > 0) {
        // Parents before children by depth so self-FK inserts stay valid
        const ordered = [...nodes].sort((a, b) => a.depth - b.depth);
        const { error } = await this.client.from("timeline_nodes").upsert(
          ordered.map((n) => ({
            id: n.id,
            simulation_id: n.simulation_id,
            parent_id: n.parent_id,
            title: n.title,
            depth: n.depth,
            score: n.score,
          })),
          { onConflict: "id" }
        );
        if (error) throw error;
      }
    }
  }

  async deleteKnowledge(knowledgeId: string): Promise<void> {
    const { error } = await this.client.from("knowledge").delete().eq("id", knowledgeId);
    if (error) throw error;
  }

  async deleteNote(noteId: string): Promise<void> {
    const { error } = await this.client.from("notes").delete().eq("id", noteId);
    if (error) throw error;
  }
}

function mapWorkspace(row: Record<string, unknown>): WorkspaceRecord {
  return {
    id: String(row.id),
    owner_id: String(row.owner_id),
    name: String(row.name),
    description: String(row.description ?? ""),
    created_at: String(row.created_at),
  };
}

function mapGoal(row: Record<string, unknown>): GoalRecord {
  return {
    id: String(row.id),
    workspace_id: String(row.workspace_id),
    title: String(row.title),
    description: String(row.description ?? ""),
    status: row.status as GoalRecord["status"],
    priority: Number(row.priority ?? 0),
    created_at: String(row.created_at),
  };
}

function mapSimulation(row: Record<string, unknown>): SimulationRecord {
  const id = String(row.id);
  return {
    id,
    workspace_id: String(row.workspace_id),
    goal_id: row.goal_id ? String(row.goal_id) : null,
    title: String(row.title ?? ""),
    status: row.status as SimulationRecord["status"],
    confidence: row.confidence == null ? null : Number(row.confidence),
    result: (row.result as SimulationRecord["result"]) ?? {},
    created_at: String(row.created_at),
    version: Number(row.version ?? 1),
    lineage_id: String(row.lineage_id ?? id),
    parent_simulation_id: row.parent_simulation_id ? String(row.parent_simulation_id) : null,
  };
}

function mapFuture(row: Record<string, unknown>): FutureRecord {
  return {
    id: String(row.id),
    simulation_id: String(row.simulation_id),
    name: String(row.name),
    score: Number(row.score ?? 0),
    risk: Number(row.risk ?? 0),
    confidence: Number(row.confidence ?? 0),
    summary: String(row.summary ?? ""),
  };
}

function mapKnowledge(row: Record<string, unknown>): KnowledgeRecord {
  return {
    id: String(row.id),
    workspace_id: String(row.workspace_id),
    type: row.type as KnowledgeRecord["type"],
    title: String(row.title),
    content: String(row.content ?? ""),
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    created_at: String(row.created_at),
  };
}

function mapNote(row: Record<string, unknown>): NoteRecord {
  return {
    id: String(row.id),
    workspace_id: String(row.workspace_id),
    title: String(row.title),
    content: String(row.content ?? ""),
    created_at: String(row.created_at),
  };
}

function mapTimelineNode(row: Record<string, unknown>): TimelineNodeRecord {
  return {
    id: String(row.id),
    simulation_id: String(row.simulation_id),
    parent_id: row.parent_id ? String(row.parent_id) : null,
    title: String(row.title),
    depth: Number(row.depth ?? 0),
    score: Number(row.score ?? 0),
  };
}

export const supabaseWorkspaceRepository = new SupabaseWorkspaceRepository();
