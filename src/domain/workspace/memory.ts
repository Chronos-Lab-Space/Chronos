import type { FutureRecord, SimulationRecord, SimulationReport, WorkspaceHome } from "./types";

/**
 * Phase 6 — Persistent memory is history (no AI memory).
 * Hierarchy: Workspace → Simulation → Future → Report
 */

export type SimulationLineage = {
  lineage_id: string;
  title: string;
  versions: readonly SimulationRecord[];
  latest: SimulationRecord;
};

export type SimulationCompare = {
  left: SimulationRecord;
  right: SimulationRecord;
  leftFutures: readonly FutureRecord[];
  rightFutures: readonly FutureRecord[];
  confidenceDelta: number | null;
  bestFutureLeft: string;
  bestFutureRight: string;
  bestFutureChanged: boolean;
  sameLineage: boolean;
};

/** Group simulations into version lineages (newest first within each). */
export function groupByLineage(simulations: readonly SimulationRecord[]): SimulationLineage[] {
  const map = new Map<string, SimulationRecord[]>();
  for (const sim of simulations) {
    const key = sim.lineage_id || sim.id;
    const list = map.get(key) ?? [];
    list.push(sim);
    map.set(key, list);
  }

  const lineages: SimulationLineage[] = [];
  for (const [lineage_id, versions] of map) {
    const sorted = [...versions].sort(
      (a, b) => b.version - a.version || b.created_at.localeCompare(a.created_at)
    );
    lineages.push({
      lineage_id,
      title: sorted[0]?.title ?? "Simulation",
      versions: sorted,
      latest: sorted[0],
    });
  }

  return lineages.sort((a, b) => b.latest.created_at.localeCompare(a.latest.created_at));
}

export function versionsFor(
  simulations: readonly SimulationRecord[],
  simulationId: string
): SimulationRecord[] {
  const target = simulations.find((s) => s.id === simulationId);
  if (!target) return [];
  const lineage = target.lineage_id || target.id;
  return simulations
    .filter((s) => (s.lineage_id || s.id) === lineage)
    .sort((a, b) => a.version - b.version);
}

export function buildReport(home: WorkspaceHome, simulationId: string): SimulationReport | null {
  const simulation = home.recentSimulations.find((s) => s.id === simulationId);
  if (!simulation) return null;

  const risks = Array.isArray(simulation.result.risks) ? (simulation.result.risks as string[]) : [];
  const tasks = Array.isArray(simulation.result.tasks)
    ? (simulation.result.tasks as SimulationReport["tasks"])
    : [];
  const constraints = Array.isArray(simulation.result.constraints)
    ? (simulation.result.constraints as string[])
    : [];

  return {
    workspace_id: home.workspace.id,
    workspace_name: home.workspace.name,
    simulation,
    futures: home.futuresBySimulation[simulationId] ?? [],
    recommendation:
      typeof simulation.result.recommendation === "string"
        ? simulation.result.recommendation
        : typeof simulation.result.thesis === "string"
          ? simulation.result.thesis
          : "",
    risks,
    tasks,
    constraints,
  };
}

export function compareSimulations(
  left: SimulationRecord,
  right: SimulationRecord,
  leftFutures: readonly FutureRecord[],
  rightFutures: readonly FutureRecord[]
): SimulationCompare {
  const bestFutureLeft = String(left.result.best_future ?? leftFutures[0]?.name ?? "—");
  const bestFutureRight = String(right.result.best_future ?? rightFutures[0]?.name ?? "—");
  const confL = left.confidence;
  const confR = right.confidence;

  return {
    left,
    right,
    leftFutures,
    rightFutures,
    confidenceDelta:
      confL == null || confR == null ? null : Math.round((confR - confL) * 1000) / 1000,
    bestFutureLeft,
    bestFutureRight,
    bestFutureChanged: bestFutureLeft !== bestFutureRight,
    sameLineage: (left.lineage_id || left.id) === (right.lineage_id || right.id),
  };
}

export function versionLabel(sim: SimulationRecord): string {
  return `v${sim.version}`;
}
