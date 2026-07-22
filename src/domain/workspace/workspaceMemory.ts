/**
 * Persistent memory helpers — leave and come back to goals, sims,
 * decision history, knowledge, and past outcomes.
 */
import type {
  GoalRecord,
  OutcomeFollowed,
  SimulationRecord,
  WorkspaceHome,
} from "./types";

export type PendingDecision = {
  simulationId: string;
  title: string;
  reason: "choose_path" | "record_followed" | "record_outcome";
  detail: string;
  createdAt: string;
  href: string;
};

export type DecisionHistoryItem = {
  simulationId: string;
  title: string;
  pathName: string;
  chosenAt: string;
  confidence: number | null;
  followed: OutcomeFollowed | null;
  outcomeResult: string | null;
  href: string;
};

export type ActivityItem = {
  id: string;
  kind: "goal" | "simulation" | "decision" | "knowledge" | "note" | "outcome";
  title: string;
  detail: string;
  at: string;
  href?: string;
};

/** Simulations completed without a saved path, or path saved without outcome feedback. */
export function listPendingDecisions(home: WorkspaceHome): PendingDecision[] {
  const pending: PendingDecision[] = [];

  for (const sim of home.recentSimulations) {
    if (sim.status !== "completed") {
      if (sim.status === "running" || sim.status === "queued") {
        pending.push({
          simulationId: sim.id,
          title: sim.title,
          reason: "choose_path",
          detail: "Simulation still running — open when complete.",
          createdAt: sim.created_at,
          href: `/workspace/simulations/${sim.id}`,
        });
      }
      continue;
    }

    if (!sim.result.chosen_future_id) {
      pending.push({
        simulationId: sim.id,
        title: sim.title,
        reason: "choose_path",
        detail: "Compare futures and choose a path.",
        createdAt: sim.created_at,
        href: `/workspace/simulations/${sim.id}`,
      });
      continue;
    }

    if (!sim.result.outcome_followed) {
      pending.push({
        simulationId: sim.id,
        title: sim.title,
        reason: "record_followed",
        detail: "Did you follow this recommendation?",
        createdAt:
          (typeof sim.result.chosen_at === "string" && sim.result.chosen_at) ||
          sim.created_at,
        href: `/workspace/simulations/${sim.id}`,
      });
      continue;
    }

    if (!sim.result.outcome_result) {
      pending.push({
        simulationId: sim.id,
        title: sim.title,
        reason: "record_outcome",
        detail: "How did it turn out?",
        createdAt:
          (typeof sim.result.outcome_followed_at === "string" &&
            sim.result.outcome_followed_at) ||
          sim.created_at,
        href: `/workspace/simulations/${sim.id}`,
      });
    }
  }

  return pending;
}

/** Saved path decisions — durable decision history. */
export function listDecisionHistory(home: WorkspaceHome): DecisionHistoryItem[] {
  const items: DecisionHistoryItem[] = [];
  for (const sim of home.recentSimulations) {
    const pathName =
      (typeof sim.result.chosen_future_name === "string" && sim.result.chosen_future_name) ||
      null;
    const chosenAt =
      (typeof sim.result.chosen_at === "string" && sim.result.chosen_at) || null;
    if (!pathName || !chosenAt) continue;

    const followed =
      sim.result.outcome_followed === "yes" ||
      sim.result.outcome_followed === "partially" ||
      sim.result.outcome_followed === "no"
        ? sim.result.outcome_followed
        : null;

    items.push({
      simulationId: sim.id,
      title: sim.title,
      pathName,
      chosenAt,
      confidence: sim.confidence,
      followed,
      outcomeResult:
        typeof sim.result.outcome_result === "string" ? sim.result.outcome_result : null,
      href: `/workspace/simulations/${sim.id}`,
    });
  }
  return items.sort((a, b) => b.chosenAt.localeCompare(a.chosenAt));
}

/** Chronological activity for “What changed since last time?” */
export function buildActivityFeed(home: WorkspaceHome, limit = 10): ActivityItem[] {
  const items: ActivityItem[] = [];

  if (home.goal) {
    items.push({
      id: `goal-${home.goal.id}`,
      kind: "goal",
      title: home.goal.title,
      detail: "Active objective",
      at: home.goal.created_at,
      href: "/workspace",
    });
  }

  for (const g of home.goalHistory ?? []) {
    items.push({
      id: `goal-hist-${g.id}-${g.created_at}`,
      kind: "goal",
      title: g.title,
      detail: "Previous goal",
      at: g.created_at,
      href: "/workspace/memory",
    });
  }

  for (const sim of home.recentSimulations) {
    items.push({
      id: `sim-${sim.id}`,
      kind: "simulation",
      title: sim.title,
      detail: `Simulation v${sim.version} · ${sim.status}`,
      at: sim.created_at,
      href: `/workspace/simulations/${sim.id}`,
    });

    if (typeof sim.result.chosen_at === "string" && sim.result.chosen_future_name) {
      items.push({
        id: `dec-${sim.id}`,
        kind: "decision",
        title: String(sim.result.chosen_future_name),
        detail: `Path saved for “${sim.title}”`,
        at: sim.result.chosen_at,
        href: `/workspace/simulations/${sim.id}`,
      });
    }

    if (
      typeof sim.result.outcome_followed_at === "string" &&
      sim.result.outcome_followed
    ) {
      items.push({
        id: `out-f-${sim.id}`,
        kind: "outcome",
        title: `Followed: ${sim.result.outcome_followed}`,
        detail: sim.title,
        at: sim.result.outcome_followed_at,
        href: `/workspace/simulations/${sim.id}`,
      });
    }

    if (typeof sim.result.outcome_result_at === "string" && sim.result.outcome_result) {
      items.push({
        id: `out-r-${sim.id}`,
        kind: "outcome",
        title: "Outcome logged",
        detail:
          sim.result.outcome_result.length > 80
            ? `${sim.result.outcome_result.slice(0, 77)}…`
            : sim.result.outcome_result,
        at: sim.result.outcome_result_at,
        href: `/workspace/simulations/${sim.id}`,
      });
    }
  }

  for (const k of home.knowledge) {
    items.push({
      id: `k-${k.id}`,
      kind: "knowledge",
      title: k.title,
      detail: `Knowledge · ${k.type}`,
      at: k.created_at,
      href: "/workspace/knowledge",
    });
  }

  for (const n of home.notes) {
    // Skip auto decision notes already represented as decisions
    if (n.title.startsWith("Decision:")) continue;
    items.push({
      id: `n-${n.id}`,
      kind: "note",
      title: n.title,
      detail: "Note",
      at: n.created_at,
      href: "/workspace/knowledge",
    });
  }

  return items
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, limit);
}

/** Snapshot a goal into history when the objective changes. */
export function archiveGoalIfChanged(
  current: GoalRecord | null,
  nextTitle: string,
  nextDescription: string,
  history: readonly GoalRecord[]
): GoalRecord[] {
  if (!current) return [...history];
  if (current.title === nextTitle && current.description === nextDescription) {
    return [...history];
  }
  // Only archive when the decision itself changes (title), not minor description edits.
  if (current.title === nextTitle) return [...history];
  const archived: GoalRecord = { ...current, status: "archived" };
  // Dedupe by id+title head
  const rest = history.filter((g) => !(g.id === archived.id && g.title === archived.title));
  return [archived, ...rest].slice(0, 40);
}

export function hasPathSaved(sim: SimulationRecord): boolean {
  return Boolean(sim.result.chosen_future_id);
}

export function needsOutcomeFollowUp(sim: SimulationRecord): boolean {
  return Boolean(sim.result.chosen_future_id) && !sim.result.outcome_followed;
}
