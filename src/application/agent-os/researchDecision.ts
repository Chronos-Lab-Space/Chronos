/**
 * Competitive and market context for a decision the user asked about.
 *
 * User-initiated, never automatic. Research informs a choice rather than
 * following one, so running it after a collapse would be backwards — and
 * running it before, on every decision, would put a model call on the path
 * the product describes as deterministic. Asking for it explicitly keeps
 * both claims true.
 *
 * Same contract as planChosenPath: prose only, fails open to nothing, and
 * labels whether a provider actually produced the text.
 */

import { Task } from "../../domain/chronos/task-os";
import { type CapabilityRegistry, ExecutionRuntime } from "./AgentOperatingSystem";

export type ResearchRequest = {
  objective: string;
};

export type ResearchResult = {
  findings: string[];
  /** "ai" only when a provider actually produced the findings. */
  source: "ai" | "stub";
};

const EMPTY: ResearchResult = { findings: [], source: "stub" };

export async function researchDecision(
  registry: CapabilityRegistry,
  request: ResearchRequest
): Promise<ResearchResult> {
  const objective = request.objective.trim();
  if (!objective) return EMPTY;

  try {
    const execution = await new ExecutionRuntime(registry).execute(
      new Task({
        id: `research-${objective.slice(0, 40)}`,
        kind: "research.competitors",
        title: "Research context",
        capability: "research.competitors",
        input: { prompt: objective },
      })
    );

    if (execution.status !== "completed") return EMPTY;

    const findings = Array.isArray(execution.output.findings)
      ? execution.output.findings.filter((f): f is string => typeof f === "string" && f.length > 0)
      : [];
    if (findings.length === 0) return EMPTY;

    return { findings, source: execution.output.source === "ai" ? "ai" : "stub" };
  } catch (err) {
    console.warn("[chronos] research skipped; the decision is unaffected.", err);
    return EMPTY;
  }
}
