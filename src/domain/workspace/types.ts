/**
 * Phase-1 workspace persistence model.
 * Mirrors supabase tables: workspaces, workspace_goals, simulations, knowledge, notes.
 */

export type GoalStatus = "active" | "paused" | "completed" | "archived";
export type SimulationStatus = "queued" | "running" | "completed" | "failed";
export type KnowledgeType = "pdf" | "note" | "website" | "research" | "other";

export type WorkspaceRecord = {
  id: string;
  name: string;
  owner_id: string;
  created_at: string;
};

export type WorkspaceGoalRecord = {
  id: string;
  workspace_id: string;
  title: string;
  description: string;
  status: GoalStatus;
  created_at: string;
  updated_at: string;
};

export type SimulationRecord = {
  id: string;
  workspace_id: string;
  goal_id: string | null;
  status: SimulationStatus;
  /** 0–1 when completed; null while queued/running. */
  confidence: number | null;
  title: string;
  best_outcome: string | null;
  futures_count: number;
  created_at: string;
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
  updated_at: string;
};

/** Aggregated view the Workspace UI renders. */
export type WorkspaceHome = {
  workspace: WorkspaceRecord;
  goal: WorkspaceGoalRecord | null;
  recentSimulations: readonly SimulationRecord[];
  knowledge: readonly KnowledgeRecord[];
  notes: readonly NoteRecord[];
};
