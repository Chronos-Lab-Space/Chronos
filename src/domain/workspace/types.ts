/**
 * Phase 2 product model — mirrors Supabase tables:
 * workspaces, goals, simulations, futures, knowledge, notes, timeline_nodes
 */

export type GoalStatus = "active" | "paused" | "completed" | "archived";
export type SimulationStatus = "queued" | "running" | "completed" | "failed";
/** RAG-lite knowledge types (not a full graph). */
export type KnowledgeType = "pdf" | "url" | "note" | "markdown" | "txt" | "github";

export type WorkspaceRecord = {
  id: string;
  owner_id: string;
  name: string;
  description: string;
  created_at: string;
};

export type GoalRecord = {
  id: string;
  workspace_id: string;
  title: string;
  description: string;
  status: GoalStatus;
  priority: number;
  created_at: string;
};

export type SimulationTaskStatus = "pending" | "running" | "completed" | "failed";

export type SimulationTaskRecord = {
  id: string;
  title: string;
  status: SimulationTaskStatus;
  phase: "plan" | "generate" | "evaluate" | "rank" | "collapse";
};

/** Did the user follow Chronos' recommendation after choosing a path? */
export type OutcomeFollowed = "yes" | "partially" | "no";

export type SimulationResultPayload = {
  best_future?: string;
  futures_count?: number;
  category?: string;
  thesis?: string;
  recommendation?: string;
  risks?: string[];
  tasks?: SimulationTaskRecord[];
  constraints?: string[];
  /** User-chosen path (may differ from engine-ranked best_future). */
  chosen_future_id?: string;
  chosen_future_name?: string;
  chosen_at?: string;
  chosen_summary?: string;
  /**
   * Outcome tracking — persistent memory after a recommendation.
   * Step 1: Did you follow this recommendation?
   * Step 2: How did it turn out?
   */
  outcome_followed?: OutcomeFollowed | null;
  outcome_followed_at?: string | null;
  outcome_result?: string | null;
  outcome_result_at?: string | null;
  [key: string]: unknown;
};

export type SimulationRecord = {
  id: string;
  workspace_id: string;
  goal_id: string | null;
  title: string;
  status: SimulationStatus;
  /** 0–1 when completed */
  confidence: number | null;
  result: SimulationResultPayload;
  created_at: string;
  /**
   * Persistent memory / versioning.
   * lineage_id groups Simulation v1 → v2 → v3; parent links the re-run source.
   */
  version: number;
  lineage_id: string;
  parent_simulation_id: string | null;
};

/** Full reopenable report: Workspace → Simulation → Futures → Report */
export type SimulationReport = {
  workspace_id: string;
  workspace_name: string;
  simulation: SimulationRecord;
  futures: readonly FutureRecord[];
  recommendation: string;
  risks: readonly string[];
  tasks: readonly SimulationTaskRecord[];
  constraints: readonly string[];
};

export type FutureRecord = {
  id: string;
  simulation_id: string;
  name: string;
  score: number;
  risk: number;
  confidence: number;
  summary: string;
};

export type KnowledgeRecord = {
  id: string;
  workspace_id: string;
  type: KnowledgeType;
  title: string;
  content: string;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type NoteRecord = {
  id: string;
  workspace_id: string;
  title: string;
  content: string;
  created_at: string;
};

export type TimelineNodeRecord = {
  id: string;
  simulation_id: string;
  parent_id: string | null;
  title: string;
  depth: number;
  score: number;
};

/** Aggregated HQ view for the Dashboard. */
export type WorkspaceHome = {
  workspace: WorkspaceRecord;
  goal: GoalRecord | null;
  /** Previous goals archived when the active objective changes — persistent memory. */
  goalHistory: readonly GoalRecord[];
  recentSimulations: readonly SimulationRecord[];
  knowledge: readonly KnowledgeRecord[];
  notes: readonly NoteRecord[];
  futuresBySimulation: Record<string, readonly FutureRecord[]>;
  timelineBySimulation: Record<string, readonly TimelineNodeRecord[]>;
};
