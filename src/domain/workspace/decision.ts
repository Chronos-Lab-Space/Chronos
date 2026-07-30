import { isUuid } from "./persistedIds";
import type { DecisionRecord, SimulationRecord, WorkspaceHome } from "./types";

/**
 * Decisions as first-class objects — see SPEC-decision-object.md.
 *
 * A decision is the question. A simulation is one attempt at answering it.
 * Re-running does not create a new decision; it creates a new version of the
 * one you already had.
 *
 * The `decisions` table, its RLS policies, and `simulations.decision_id` all
 * shipped in `20260721120000_public_beta_auth.sql` and were then left unused,
 * while the product described them as done. This module is the half that was
 * missing.
 */

/**
 * Derived from a decision's versions on every read, never stored.
 *
 * `decisions.status` exists as a column and is deliberately left at its
 * default. Writing it would create a second source of truth that drifts from
 * the versions it summarises — which is exactly how `decision_id` came to be
 * a column nobody maintained.
 */
export type DecisionStatus = "open" | "decided" | "executed";

export type DecisionWithVersions = {
  decision: DecisionRecord;
  /** Newest version first. Never empty. */
  versions: readonly SimulationRecord[];
  /** The version to open by default — highest version number. */
  latest: SimulationRecord;
  status: DecisionStatus;
};

function hasText(value: unknown): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * The decision a simulation belongs to.
 *
 * A lineage *is* a decision: v1 → v2 → v3 are three attempts at one question,
 * and `lineage_id` already groups them. Reusing the lineage id as the decision
 * id makes the mapping bijective, which buys two things that a fresh uuid
 * would not:
 *
 * - The SQL backfill and this function agree without coordinating.
 * - Two devices deriving it offline converge on one decision instead of two.
 *
 * A non-uuid lineage (legacy local data) falls back to the simulation's own
 * id, which is a uuid by definition — a lineage of one, as the spec requires.
 */
export function decisionIdForSimulation(sim: Pick<SimulationRecord, "id" | "lineage_id">): string {
  const lineage = typeof sim.lineage_id === "string" ? sim.lineage_id.trim() : "";
  return isUuid(lineage) ? lineage.toLowerCase() : sim.id;
}

/**
 * `open` until a version collapses to a path, `decided` once one has, and
 * `executed` once *that* version has a real outcome logged against it.
 *
 * The outcome has to sit on a chosen version: a stray note on an abandoned
 * re-run must not claim the whole decision was carried out.
 */
export function deriveDecisionStatus(versions: readonly SimulationRecord[]): DecisionStatus {
  let decided = false;
  for (const version of versions) {
    if (!hasText(version.result?.chosen_future_id)) continue;
    decided = true;
    if (version.result?.outcome_followed || hasText(version.result?.outcome_result)) {
      return "executed";
    }
  }
  return decided ? "decided" : "open";
}

/** Lowest version wins; ties break on time, then id, so the pick is stable. */
function isEarlier(candidate: SimulationRecord, current: SimulationRecord): boolean {
  const byVersion = (candidate.version ?? 1) - (current.version ?? 1);
  if (byVersion !== 0) return byVersion < 0;
  const byTime = candidate.created_at.localeCompare(current.created_at);
  if (byTime !== 0) return byTime < 0;
  return candidate.id.localeCompare(current.id) < 0;
}

function decisionFromEarliestVersion(
  id: string,
  workspaceId: string,
  first: SimulationRecord
): DecisionRecord {
  return {
    id,
    workspace_id: workspaceId,
    title: first.title,
    description: "",
    goal_id: first.goal_id,
    created_at: first.created_at,
  };
}

function sameDecisions(a: readonly DecisionRecord[], b: readonly DecisionRecord[]): boolean {
  return a.length === b.length && a.every((decision, i) => decision === b[i]);
}

/**
 * Give every simulation a decision, and the workspace one decision per lineage.
 *
 * Runs on every `normalize()`, so it doubles as the local-first half of the
 * backfill: anonymous visitors have lineages too, and their data never passes
 * through a migration.
 *
 * Existing records win over derived ones — a decision that came back from the
 * cloud, or a title the user edited, is the source of truth. Likewise a
 * simulation that already carries a `decision_id` keeps it rather than being
 * re-guessed from its lineage.
 *
 * Decisions with no surviving versions are dropped from the local list.
 * Retention trims the simulation cache, and a decision with nothing under it
 * would render as an empty row. Nothing is deleted in the cloud by this: the
 * save RPC is upsert-only, matching how trimmed simulations are already
 * treated.
 *
 * Returns the same object when there is nothing to change, so the incremental
 * dual-write fingerprint does not see a spurious diff on every persist.
 */
export function attachDecisions(home: WorkspaceHome): WorkspaceHome {
  let simulationsChanged = false;
  const recentSimulations = home.recentSimulations.map((sim) => {
    const decisionId = sim.decision_id ?? decisionIdForSimulation(sim);
    if (sim.decision_id === decisionId) return sim;
    simulationsChanged = true;
    return { ...sim, decision_id: decisionId };
  });

  const earliestByDecision = new Map<string, SimulationRecord>();
  for (const sim of recentSimulations) {
    const id = sim.decision_id ?? decisionIdForSimulation(sim);
    const current = earliestByDecision.get(id);
    if (!current || isEarlier(sim, current)) earliestByDecision.set(id, sim);
  }

  const existing = new Map((home.decisions ?? []).map((d) => [d.id, d]));
  const decisions = [...earliestByDecision.entries()]
    .map(
      ([id, first]) => existing.get(id) ?? decisionFromEarliestVersion(id, home.workspace.id, first)
    )
    .sort((a, b) => b.created_at.localeCompare(a.created_at) || a.id.localeCompare(b.id));

  if (!simulationsChanged && sameDecisions(home.decisions ?? [], decisions)) return home;
  return { ...home, recentSimulations, decisions };
}

/**
 * The read surface: decisions newest-first, each with its versions underneath.
 * Decisions with no retained versions are omitted, so `latest` always exists.
 */
export function groupDecisionsWithVersions(home: WorkspaceHome): DecisionWithVersions[] {
  const versionsByDecision = new Map<string, SimulationRecord[]>();
  for (const sim of home.recentSimulations) {
    const id = sim.decision_id ?? decisionIdForSimulation(sim);
    const bucket = versionsByDecision.get(id);
    if (bucket) bucket.push(sim);
    else versionsByDecision.set(id, [sim]);
  }

  const groups: DecisionWithVersions[] = [];
  for (const decision of home.decisions ?? []) {
    const versions = (versionsByDecision.get(decision.id) ?? []).sort(
      (a, b) => (b.version ?? 1) - (a.version ?? 1) || b.created_at.localeCompare(a.created_at)
    );
    if (versions.length === 0) continue;
    groups.push({
      decision,
      versions,
      latest: versions[0],
      status: deriveDecisionStatus(versions),
    });
  }
  return groups;
}
