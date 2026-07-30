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
  /**
   * Per-workspace fingerprint of the last payload the cloud actually
   * accepted. In memory only: a reload re-sends everything once, which is a
   * cheap way to stay self-healing if another device wrote in between.
   */
  private readonly lastSaved = new Map<string, Record<string, string>>();

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

    const futuresBySimulation: Record<string, FutureRecord[]> = {};
    const timelineBySimulation: Record<string, TimelineNodeRecord[]> = {};

    if (simIds.length > 0) {
      const [futuresRes, nodesRes] = await Promise.all([
        this.client.from("futures").select("*").in("simulation_id", simIds),
        this.client.from("timeline_nodes").select("*").in("simulation_id", simIds),
      ]);
      if (futuresRes.error) throw futuresRes.error;
      if (nodesRes.error) throw nodesRes.error;

      for (const row of futuresRes.data ?? []) {
        const f = mapFuture(row);
        futuresBySimulation[f.simulation_id] ??= [];
        futuresBySimulation[f.simulation_id].push(f);
      }
      for (const row of nodesRes.data ?? []) {
        const n = mapTimelineNode(row);
        timelineBySimulation[n.simulation_id] ??= [];
        timelineBySimulation[n.simulation_id].push(n);
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

  /**
   * Persist the whole workspace snapshot in one atomic call.
   *
   * Previously this issued seven-plus separate upserts. Each was its own
   * transaction over PostgREST, so a failure part-way through left the
   * cloud copy half-written — and WorkspaceService.persist() swallows the
   * throw, so the divergence was silent. One RPC is one transaction, so
   * the save is now all-or-nothing.
   *
   * save_workspace_home is SECURITY INVOKER, so every statement inside it
   * is still subject to this user's RLS policies. It is not a privileged
   * back door.
   *
   * Semantics are unchanged: upsert only, never delete. Removals still go
   * through deleteKnowledge / deleteNote.
   *
   * Only changed collections are sent. That is safe precisely *because* the
   * RPC never deletes: every list is read as `coalesce(payload -> 'x', '[]')`,
   * so an absent collection means "leave those rows alone". Sending the whole
   * snapshot every time meant adding a note rewrote every simulation, future
   * and timeline node — on the hosted project, ~44k row updates to maintain
   * ~600 rows.
   */
  async save(home: WorkspaceHome): Promise<void> {
    const full = buildSavePayload(home);
    const workspaceId = workspaceIdOf(full);
    const next = fingerprintCollections(full);
    const previous = this.lastSaved.get(workspaceId);

    const changed = previous
      ? Object.keys(next).filter((key) => next[key] !== previous[key])
      : Object.keys(full);

    // Nothing to write. persist() runs on read-repair and load write-through,
    // not only on real edits, so this is the common case rather than a corner.
    if (changed.length === 0) return;

    // `workspace` is the one collection the SQL reads uncoalesced, via
    // jsonb_to_record — omitting it would be an error, not a no-op.
    const payload: Record<string, unknown> = { workspace: full.workspace };
    for (const key of changed) payload[key] = full[key];

    const { error } = await this.client.rpc("save_workspace_home", { payload });
    if (error) throw error;
    // Only after the write lands. A remembered-but-unwritten snapshot would
    // make the next save omit rows the cloud never received, and persist()
    // swallows the throw — the divergence would be silent.
    this.lastSaved.set(workspaceId, next);
  }

  async deleteKnowledge(knowledgeId: string): Promise<void> {
    const { error } = await this.client.from("knowledge").delete().eq("id", knowledgeId);
    if (error) throw error;
  }

  async deleteNote(noteId: string): Promise<void> {
    const { error } = await this.client.from("notes").delete().eq("id", noteId);
    if (error) throw error;
  }

  /**
   * `futures.simulation_id` and `timeline_nodes.simulation_id` are both
   * `on delete cascade`, and `parent_simulation_id` is `on delete set null`,
   * so one delete removes the relations without orphaning later versions.
   */
  async deleteSimulations(simulationIds: readonly string[]): Promise<void> {
    if (simulationIds.length === 0) return;
    const { error } = await this.client
      .from("simulations")
      .delete()
      .in("id", [...simulationIds]);
    if (error) throw error;
    // The next save must not assume the cloud still holds what we just
    // removed, or it would omit rows that need re-creating.
    this.lastSaved.clear();
  }
}

/** Stable per-collection fingerprint. Order is already deterministic upstream. */
function fingerprintCollections(payload: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(payload)) {
    out[key] = JSON.stringify(value ?? null);
  }
  return out;
}

function workspaceIdOf(payload: Record<string, unknown>): string {
  const workspace = payload.workspace as { id?: unknown } | undefined;
  return typeof workspace?.id === "string" ? workspace.id : "";
}

/** Topological order: roots first, then children by version/created_at. */
export function orderSimulationsForUpsert(sims: readonly SimulationRecord[]): SimulationRecord[] {
  const byId = new Map(sims.map((s) => [s.id, s]));
  const visiting = new Set<string>();
  const done = new Set<string>();
  const out: SimulationRecord[] = [];

  function visit(id: string) {
    if (done.has(id) || !byId.has(id)) return;
    if (visiting.has(id)) {
      // Cycle guard — still emit once
      return;
    }
    visiting.add(id);
    const sim = byId.get(id)!;
    if (sim.parent_simulation_id) visit(sim.parent_simulation_id);
    visiting.delete(id);
    done.add(id);
    out.push(sim);
  }

  // Stable: older roots first so bulk insert is predictable
  const roots = [...sims].sort((a, b) => a.created_at.localeCompare(b.created_at));
  for (const s of roots) visit(s.id);
  return out;
}

/**
 * Shallowest first, so a self-referencing parent_id is always already inserted
 * by the time its children are.
 *
 * Safe to run across simulations at once: parent_id never crosses a simulation
 * boundary, and a parent always sits at a lower depth than its children, so a
 * single depth sort keeps every parent ahead of its own children regardless of
 * how many simulations are interleaved.
 *
 * Ties break on id purely to keep the batch order deterministic between runs.
 */
export function orderTimelineNodesForUpsert(
  nodes: readonly TimelineNodeRecord[]
): TimelineNodeRecord[] {
  return [...nodes].sort((a, b) => a.depth - b.depth || a.id.localeCompare(b.id));
}

/**
 * Flatten a WorkspaceHome into the single JSONB argument that
 * save_workspace_home expects.
 *
 * Only the columns the function actually reads are included, so the
 * request stays as small as the data allows — simulation `result` blobs
 * dominate the payload otherwise.
 *
 * Children are emitted in FK-safe order. Strictly this is belt and
 * braces: referential integrity is enforced by AFTER ROW triggers that
 * fire at the end of the statement, so a single multi-row insert accepts
 * parents and children in any order. Ordering keeps the payload
 * deterministic, which makes it diffable in logs and stable to assert on.
 */
export function buildSavePayload(home: WorkspaceHome): Record<string, unknown> {
  const w = home.workspace;
  const sims = orderSimulationsForUpsert(home.recentSimulations);

  const futures = home.recentSimulations.flatMap((sim) => home.futuresBySimulation[sim.id] ?? []);
  const timelineNodes = orderTimelineNodesForUpsert(
    home.recentSimulations.flatMap((sim) => home.timelineBySimulation[sim.id] ?? [])
  );

  return {
    workspace: {
      id: w.id,
      owner_id: w.owner_id,
      name: w.name,
      description: w.description ?? "",
      created_at: w.created_at,
    },
    goal: home.goal
      ? {
          id: home.goal.id,
          workspace_id: home.goal.workspace_id,
          title: home.goal.title,
          description: home.goal.description ?? "",
          status: home.goal.status,
          priority: home.goal.priority ?? 0,
          created_at: home.goal.created_at,
        }
      : null,
    knowledge: home.knowledge.map((k) => ({
      id: k.id,
      workspace_id: k.workspace_id,
      type: k.type,
      title: k.title,
      content: k.content ?? "",
      metadata: k.metadata ?? {},
      created_at: k.created_at,
    })),
    notes: home.notes.map((n) => ({
      id: n.id,
      workspace_id: n.workspace_id,
      title: n.title,
      content: n.content ?? "",
      created_at: n.created_at,
    })),
    simulations: sims.map((s) => ({
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
    })),
    futures: futures.map((f) => ({
      id: f.id,
      simulation_id: f.simulation_id,
      name: f.name,
      score: f.score,
      risk: f.risk,
      confidence: f.confidence,
      summary: f.summary ?? "",
    })),
    timeline_nodes: timelineNodes.map((n) => ({
      id: n.id,
      simulation_id: n.simulation_id,
      parent_id: n.parent_id,
      title: n.title,
      depth: n.depth,
      score: n.score,
    })),
  };
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
