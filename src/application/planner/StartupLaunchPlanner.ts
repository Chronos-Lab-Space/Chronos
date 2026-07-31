import { Planner } from "../agent-os/AgentOperatingSystem";
import { Task, type TaskGraph } from "../../domain/chronos/task-os";

export type LaunchStartupPlanInput = {
  workspaceId: string;
  decisionId: string;
  prompt: string;
  /** Preference strings from prior learning (injected into task context). */
  learnedPreferences?: readonly string[];
};

/**
 * A concrete planner decomposition. Users state an objective; Chronos decides
 * the work graph and resolves registered capabilities at execution time.
 */
export class StartupLaunchPlanner {
  constructor(private readonly planner = new Planner()) {}

  decompose(input: LaunchStartupPlanInput): TaskGraph {
    const context = {
      prompt: input.prompt,
      workspaceId: input.workspaceId,
      learnedPreferences: input.learnedPreferences ?? [],
    };
    return this.planner.createGraph({
      id: `task-graph-${input.decisionId}`,
      workspaceId: input.workspaceId,
      decisionId: input.decisionId,
      tasks: [
        new Task({
          id: "research-competitors",
          kind: "research.competitors",
          title: "Research competitors",
          capability: "research.competitors",
          input: context,
          priority: 6,
        }),
        new Task({
          id: "estimate-market",
          kind: "market.estimate",
          title: "Estimate market",
          capability: "market.estimate",
          input: context,
          dependencies: ["research-competitors"],
          priority: 5,
        }),
        new Task({
          id: "predict-adoption",
          kind: "adoption.predict",
          title: "Predict adoption",
          capability: "adoption.predict",
          input: context,
          dependencies: ["research-competitors", "estimate-market"],
          priority: 3,
        }),
        new Task({
          id: "financial-simulation",
          kind: "financial.simulate",
          title: "Financial simulation",
          capability: "financial.simulate",
          input: context,
          dependencies: ["estimate-market", "predict-adoption"],
          priority: 2,
        }),
        new Task({
          id: "risk-analysis",
          kind: "risk.analyze",
          title: "Risk analysis",
          capability: "risk.analyze",
          input: context,
          dependencies: ["research-competitors", "financial-simulation"],
          priority: 1,
        }),
      ],
    });
  }
}
