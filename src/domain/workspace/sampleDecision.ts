/**
 * Sample decision — a worked example a new visitor can open immediately.
 *
 * An empty workspace is the cold-start problem one step past the login wall:
 * nothing to look at until you do all the work yourself. The sample shows the
 * loop (branch → compare → collapse) before any of it.
 *
 * Two rules keep it honest:
 *
 * 1. Its futures and ranking come from the real engine at seed time, never from
 *    hand-written fixtures. A fabricated ranking, in a product whose whole claim
 *    is deterministic ranking, would be the worst thing we could ship.
 * 2. It never counts as the user's own work — not in checklist progress, not in
 *    learning memory, not in activity.
 *
 * See SPEC-anonymous-workspace.md.
 */

import type { SimulationRecord } from "./types";

/** Objective the sample is generated from. Realistic, and clearly a demo. */
export const SAMPLE_OBJECTIVE = "How should we launch our public beta with a small team?";

export const SAMPLE_WORKSPACE_NAME = "Sample workspace";

/**
 * The sample carries a source of its own. Partly realism — a worked example
 * with no context would misrepresent how the engine is meant to be used — and
 * partly because onboarding requires knowledge or a note before the workspace
 * unlocks, so a contextless sample would strand the visitor in the wizard it
 * exists to spare them.
 */
export const SAMPLE_NOTE_TITLE = "Beta constraints (sample)";
export const SAMPLE_NOTE_BODY =
  "Small team, limited runway. Prefer a path we can reverse cheaply if activation is weak.";

/**
 * Sample records carry an explicit flag. Matching on the title instead would
 * misclassify a real run that happens to ask the same question — which is
 * likely, since the objective is deliberately a common one.
 */
export function isSampleSimulation(simulation: SimulationRecord): boolean {
  return simulation.result.is_sample === true;
}

export function withoutSampleSimulations(
  simulations: readonly SimulationRecord[]
): SimulationRecord[] {
  return simulations.filter((s) => !isSampleSimulation(s));
}

export function hasSampleSimulation(simulations: readonly SimulationRecord[]): boolean {
  return simulations.some(isSampleSimulation);
}
