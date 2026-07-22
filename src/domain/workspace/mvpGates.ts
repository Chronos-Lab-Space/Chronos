import type { WorkspaceHome } from "./types";

/**
 * MVP phase gates — each step must be usable before the next.
 * Keeps Chronos focused on simulated futures, not a full Workspace OS.
 */
export type MvpGateId =
  | "workspace"
  | "persist"
  | "context"
  | "simulate"
  | "timeline"
  | "memory";

export type MvpGate = {
  id: MvpGateId;
  phase: number;
  label: string;
  usableWhen: string;
  done: boolean;
  href: string;
  cta: string;
};

export function evaluateMvpGates(home: WorkspaceHome | null): MvpGate[] {
  const hasWorkspace = Boolean(home?.workspace && home.goal);
  const hasContext =
    Boolean(home && (home.knowledge.length > 0 || home.notes.length > 0));
  const hasSimulation = Boolean(home && home.recentSimulations.length > 0);
  const latestId = home?.recentSimulations[0]?.id;
  const hasFutures = Boolean(
    latestId && (home?.futuresBySimulation[latestId]?.length ?? 0) > 0
  );
  const hasHistory = Boolean(home && home.recentSimulations.length >= 2);

  return [
    {
      id: "workspace",
      phase: 1,
      label: "Workspace",
      usableWhen: "Sign in and navigate a workspace HQ",
      done: hasWorkspace,
      href: "/workspace",
      cta: "Open HQ",
    },
    {
      id: "persist",
      phase: 2,
      label: "Persist",
      usableWhen: "Data survives reload (local history store)",
      done: hasWorkspace, // create/goal writes to store; reload restores
      href: "/workspace/settings",
      cta: "Settings",
    },
    {
      id: "context",
      phase: 3,
      label: "Context",
      usableWhen: "Provide knowledge for simulations",
      done: hasContext,
      href: "/workspace/knowledge",
      cta: hasContext ? "Library" : "Add context",
    },
    {
      id: "simulate",
      phase: 4,
      label: "Simulate",
      usableWhen: "Generate and rank multiple futures",
      done: hasSimulation,
      href: "/workspace/simulations?new=1",
      cta: hasSimulation ? "Simulations" : "Run engine",
    },
    {
      id: "timeline",
      phase: 5,
      label: "Timeline",
      usableWhen: "Inspect futures as cards (summary, risk, next steps)",
      done: hasFutures,
      href: "/workspace/timeline",
      cta: hasFutures ? "Open timeline" : "Need a run",
    },
    {
      id: "memory",
      phase: 6,
      label: "Memory",
      usableWhen: "Work accumulates — re-run and compare versions",
      done: hasHistory,
      href: "/workspace/simulations",
      cta: hasHistory ? "Simulations" : "Re-run a sim",
    },
  ];
}

export function nextMvpGate(home: WorkspaceHome | null): MvpGate | null {
  return evaluateMvpGates(home).find((g) => !g.done) ?? null;
}
