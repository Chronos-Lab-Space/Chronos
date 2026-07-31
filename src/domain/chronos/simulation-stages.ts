/**
 * The phases `simulate()` actually performs, in order.
 *
 * The public simulator UI used to render `StartupLaunchPlanner` task titles as
 * its pipeline. Those tasks are never executed on this path — the planner graph
 * only runs through the capability registry, which no public surface calls — so
 * the UI narrated six agent steps over a deterministic Monte Carlo run.
 *
 * Keep these labels tied to `simulate()` in `startup-sim.ts`. If a phase moves,
 * the label moves with it; if a phase stops existing, the label goes.
 */
export type SimulationStage = {
  id: string;
  label: string;
};

export const SIMULATION_STAGES: readonly SimulationStage[] = [
  { id: "categorize", label: "Classifying the idea" },
  { id: "sample", label: "Sampling futures per archetype" },
  { id: "score", label: "Scoring expected value" },
  { id: "rank", label: "Ranking by expected value" },
  { id: "collapse", label: "Collapsing to the best path" },
];
