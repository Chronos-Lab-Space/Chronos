import { agents } from "./agents";
import { CapabilityRegistration, type TaskKind } from "./task-os";
import type { Scenario } from "./types";

export type CapabilityWorkload = {
  id: string;
  name: string;
  domain: string;
  description: string;
  accent: string;
  icon: "forge" | "oracle" | "atlas";
  scenario: Scenario;
  problem: string;
  candidateScenarios: readonly string[];
  stakes: string;
  capabilities: readonly CapabilityRegistration[];
};

const taskKinds: readonly TaskKind[] = [
  "plan",
  "research.competitors",
  "market.estimate",
  "adoption.predict",
  "financial.simulate",
  "risk.analyze",
  "scenario.generate",
  "branch.generate",
  "simulation.execute",
  "outcome.evaluate",
  "timeline.rank",
  "memory.write",
];

const workloadMetadata = {
  forge: {
    name: "Coding Workload",
    domain: "Code planning capability",
    description:
      "Registered capabilities for code planning, change-risk simulation, test coverage analysis, and release decisions.",
  },
  oracle: {
    name: "Market Workload",
    domain: "Market simulation capability",
    description:
      "Registered capabilities for position planning, event simulation, downside analysis, and risk-adjusted ranking.",
  },
  atlas: {
    name: "Strategy Workload",
    domain: "Business planning capability",
    description:
      "Registered capabilities for company strategy, scenario generation, runway planning, and growth evaluation.",
  },
} as const;

/**
 * Marketing / Product demo workloads (Forge · Oracle · Atlas).
 *
 * These are **illustrative** CapabilityRegistration records for the Product UI.
 * They are not the live Agent OS registry. Product task handlers are wired in
 * `application/agent-os/createDefaultCapabilityRegistry.ts` (research, simulation,
 * evaluation, memory, plan stub, roadmap stub).
 *
 * Demo scenarios in `agents.ts` are hand-authored world models for the temporal
 * engine playground — not LLM agents.
 */
export const capabilityWorkloads: readonly CapabilityWorkload[] = agents.map((agent) => {
  const metadata =
    workloadMetadata[agent.id as keyof typeof workloadMetadata] ?? workloadMetadata.forge;
  return {
    id: agent.id,
    name: metadata.name,
    domain: metadata.domain,
    description: metadata.description,
    accent: agent.accent,
    icon: agent.icon,
    scenario: agent.scenario,
    problem: agent.narrative.problem,
    candidateScenarios: agent.narrative.whatItSimulates,
    stakes: agent.narrative.stakes,
    capabilities: [
      new CapabilityRegistration({
        id: `${agent.id}-planning`,
        providerId: `${agent.id}-provider`,
        name: `${metadata.domain} planner`,
        version: "1.0.0",
        taskKinds,
        capabilityKeys: [
          "research.competitors",
          "market.estimate",
          "adoption.predict",
          "financial.simulate",
          "risk.analyze",
        ],
        description: metadata.description,
      }),
    ],
  };
});

export function getCapabilityWorkload(id: string): CapabilityWorkload {
  return capabilityWorkloads.find((workload) => workload.id === id) ?? capabilityWorkloads[0];
}
