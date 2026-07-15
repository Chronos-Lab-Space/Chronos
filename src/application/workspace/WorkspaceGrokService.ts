import { grokClient, type GrokChatMessage } from "../../infrastructure/ai/GrokClient";
import type { WorkspaceHome } from "../../domain/workspace/types";

/**
 * Builds Chronos workspace context and calls Grok for decision support.
 */
export class WorkspaceGrokService {
  buildContext(home: WorkspaceHome, extras?: { simulationId?: string }): string {
    const lines: string[] = [];
    lines.push(`Workspace: ${home.workspace.name}`);
    if (home.workspace.description) lines.push(`Description: ${home.workspace.description}`);
    if (home.goal) {
      lines.push(`Active goal: ${home.goal.title}`);
      if (home.goal.description) lines.push(`Goal detail: ${home.goal.description}`);
    }

    if (home.knowledge.length) {
      lines.push("Knowledge library:");
      for (const k of home.knowledge.slice(0, 12)) {
        const body = k.content.replace(/\s+/g, " ").trim().slice(0, 280);
        lines.push(`- [${k.type}] ${k.title}${body ? ` — ${body}` : ""}`);
      }
    }

    if (home.notes.length) {
      lines.push("Notes:");
      for (const n of home.notes.slice(0, 8)) {
        lines.push(`- ${n.title}: ${n.content.replace(/\s+/g, " ").trim().slice(0, 200)}`);
      }
    }

    if (home.recentSimulations.length) {
      lines.push("Recent simulations:");
      for (const s of home.recentSimulations.slice(0, 6)) {
        lines.push(
          `- v${s.version} “${s.title}” status=${s.status} best=${String(s.result.best_future ?? "—")} conf=${s.confidence ?? "—"}`
        );
      }
    }

    if (extras?.simulationId) {
      const sim = home.recentSimulations.find((s) => s.id === extras.simulationId);
      const futures = home.futuresBySimulation[extras.simulationId] ?? [];
      if (sim) {
        lines.push("Focus simulation report:");
        lines.push(`Title: ${sim.title}`);
        lines.push(`Recommendation: ${String(sim.result.recommendation ?? "")}`);
        lines.push(`Thesis: ${String(sim.result.thesis ?? "")}`);
        if (Array.isArray(sim.result.risks)) {
          lines.push(`Risks: ${(sim.result.risks as string[]).join("; ")}`);
        }
        if (futures.length) {
          lines.push("Futures:");
          for (const f of futures) {
            lines.push(
              `- ${f.name} score=${f.score} risk=${f.risk} conf=${f.confidence}: ${f.summary}`
            );
          }
        }
      }
    }

    return lines.join("\n");
  }

  async ask(
    home: WorkspaceHome,
    messages: GrokChatMessage[],
    options?: { simulationId?: string }
  ): Promise<string> {
    const context = this.buildContext(home, options);
    const res = await grokClient.chat({ messages, context });
    return res.content;
  }

  async adviseOnGoal(home: WorkspaceHome): Promise<string> {
    return this.ask(home, [
      {
        role: "user",
        content:
          "Given my workspace goal, knowledge, and any past simulations, what should I prioritize next? " +
          "Give: (1) a short read of the situation, (2) 3 decision options with tradeoffs, (3) a recommended next simulation objective.",
      },
    ]);
  }

  async enhanceSimulationReport(
    home: WorkspaceHome,
    simulationId: string
  ): Promise<string> {
    return this.ask(
      home,
      [
        {
          role: "user",
          content:
            "Critique and strengthen this simulation report for an executive. " +
            "Return: sharpened recommendation, top risks with mitigations, and a 7-day action plan. " +
            "Stay faithful to the ranked futures — do not invent data.",
        },
      ],
      { simulationId }
    );
  }
}

export const workspaceGrokService = new WorkspaceGrokService();
