import type { SimulationRecord, WorkspaceHome } from "./types";

/**
 * Canonical decision history — single model for HQ preview + Timeline page.
 * Narrative events only (not file-edit noise).
 */

export type DecisionHistoryKind =
  | "workspace_created"
  | "goal_set"
  | "knowledge_added"
  | "simulation_completed"
  | "recommendation_ready"
  | "decision_accepted"
  | "outcome_logged";

export type DecisionHistoryEvent = {
  id: string;
  kind: DecisionHistoryKind;
  label: string;
  at: string; // ISO
  href?: string;
};

const DEFAULT_PREVIEW = 5;

/**
 * Full chronological story: oldest → newest (workspace → outcome).
 */
export function deriveDecisionHistory(home: WorkspaceHome): DecisionHistoryEvent[] {
  const events: DecisionHistoryEvent[] = [];

  events.push({
    id: `workspace-${home.workspace.id}`,
    kind: "workspace_created",
    label: "Workspace created",
    at: home.workspace.created_at,
    href: "/workspace",
  });

  if (home.goal?.title?.trim()) {
    events.push({
      id: `goal-${home.goal.id}`,
      kind: "goal_set",
      label: "Goal set",
      at: home.goal.created_at,
      href: "/workspace",
    });
  }

  const knowledgeItems = [
    ...home.knowledge.map((k) => ({ at: k.created_at, id: k.id })),
    ...home.notes.map((n) => ({ at: n.created_at, id: n.id })),
  ].sort((a, b) => a.at.localeCompare(b.at));

  if (knowledgeItems.length > 0) {
    const first = knowledgeItems[0]!;
    const count = knowledgeItems.length;
    events.push({
      id: `knowledge-${first.id}`,
      kind: "knowledge_added",
      label:
        count === 1
          ? "Knowledge added"
          : `Knowledge added (${count} sources)`,
      at: first.at,
      href: "/workspace/knowledge",
    });
  }

  // Oldest simulations first for narrative; list is usually newest-first in home
  const simsChrono = [...home.recentSimulations].sort((a, b) =>
    a.created_at.localeCompare(b.created_at)
  );

  for (const sim of simsChrono) {
    if (sim.status !== "completed" && sim.status !== "failed") continue;

    if (sim.status === "completed") {
      events.push({
        id: `sim-completed-${sim.id}`,
        kind: "simulation_completed",
        label: simulationCompletedLabel(sim, home),
        at: sim.created_at,
        href: `/workspace/simulations/${sim.id}`,
      });

      events.push({
        id: `rec-ready-${sim.id}`,
        kind: "recommendation_ready",
        label: recommendationLabel(sim),
        at: sim.created_at,
        href: `/workspace/simulations/${sim.id}`,
      });
    }

    if (typeof sim.result.chosen_future_id === "string" && sim.result.chosen_future_id) {
      const acceptedAt =
        typeof sim.result.chosen_at === "string" && sim.result.chosen_at
          ? sim.result.chosen_at
          : sim.created_at;
      events.push({
        id: `decision-accepted-${sim.id}`,
        kind: "decision_accepted",
        label: decisionAcceptedLabel(sim),
        at: acceptedAt,
        href: `/workspace/simulations/${sim.id}`,
      });
    }

    if (sim.result.outcome_followed || sim.result.outcome_result) {
      const outcomeAt =
        (typeof sim.result.outcome_result_at === "string" && sim.result.outcome_result_at) ||
        (typeof sim.result.outcome_followed_at === "string" && sim.result.outcome_followed_at) ||
        sim.created_at;
      events.push({
        id: `outcome-${sim.id}`,
        kind: "outcome_logged",
        label: "Outcome logged",
        at: outcomeAt,
        href: `/workspace/simulations/${sim.id}`,
      });
    }
  }

  // Stable sort by time, then kind rank for same timestamp
  return events.sort((a, b) => {
    const t = a.at.localeCompare(b.at);
    if (t !== 0) return t;
    return kindRank(a.kind) - kindRank(b.kind);
  });
}

/**
 * HQ “Recent Activity”: newest first, limited.
 */
export function decisionHistoryPreview(
  home: WorkspaceHome,
  limit: number = DEFAULT_PREVIEW
): DecisionHistoryEvent[] {
  const full = deriveDecisionHistory(home);
  const n = Math.max(1, Math.min(limit, 10));
  return [...full].reverse().slice(0, n);
}

function simulationCompletedLabel(sim: SimulationRecord, home: WorkspaceHome): string {
  const idx =
    [...home.recentSimulations]
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .findIndex((s) => s.id === sim.id) + 1;
  return idx > 0 ? `Simulation #${idx} completed` : "Simulation completed";
}

function recommendationLabel(sim: SimulationRecord): string {
  const name =
    (typeof sim.result.chosen_future_name === "string" && sim.result.chosen_future_name) ||
    (typeof sim.result.best_future === "string" && sim.result.best_future) ||
    null;
  return name ? `Recommendation ready · ${name}` : "Recommendation ready";
}

function decisionAcceptedLabel(sim: SimulationRecord): string {
  const name =
    (typeof sim.result.chosen_future_name === "string" && sim.result.chosen_future_name) ||
    null;
  return name ? `Decision accepted · ${name}` : "Decision accepted";
}

function kindRank(kind: DecisionHistoryKind): number {
  const order: DecisionHistoryKind[] = [
    "workspace_created",
    "goal_set",
    "knowledge_added",
    "simulation_completed",
    "recommendation_ready",
    "decision_accepted",
    "outcome_logged",
  ];
  return order.indexOf(kind);
}
