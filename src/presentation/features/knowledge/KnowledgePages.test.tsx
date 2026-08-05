import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import type { WorkspaceHome } from "../../../domain/workspace/types";
import { KnowledgePage } from "./KnowledgePages";

const home = vi.hoisted(() => ({ current: null as WorkspaceHome | null }));

vi.mock("../workspace/WorkspaceContext", () => ({
  useWorkspace: () => ({ home: home.current, addKnowledge: vi.fn(), error: null }),
}));

function workspaceHome(knowledgeUsed: string[][]): WorkspaceHome {
  return {
    workspace: { id: "w1", owner_id: "u1", name: "Lab", description: "", created_at: "" },
    goal: null,
    goalHistory: [],
    decisions: [],
    recentSimulations: knowledgeUsed.map((ids, i) => ({
      id: `s${i}`,
      workspace_id: "w1",
      goal_id: null,
      title: `Run ${i}`,
      status: "completed",
      confidence: 0.7,
      result: { knowledge_used: ids.map((id) => ({ id, title: id, type: "document" })) },
      created_at: "2026-07-20T00:00:00.000Z",
      version: 1,
      lineage_id: `s${i}`,
      parent_simulation_id: null,
    })),
    knowledge: [
      {
        id: "k1",
        workspace_id: "w1",
        type: "markdown",
        title: "Product roadmap",
        content: "Quarterly plan",
        metadata: {},
        created_at: "2026-07-01T00:00:00.000Z",
      },
      {
        id: "k2",
        workspace_id: "w1",
        type: "markdown",
        title: "Press list",
        content: "Embargo notes",
        metadata: {},
        created_at: "2026-07-02T00:00:00.000Z",
      },
    ],
    notes: [],
    futuresBySimulation: {},
    timelineBySimulation: {},
  } as unknown as WorkspaceHome;
}

function renderKnowledge(knowledgeUsed: string[][]) {
  home.current = workspaceHome(knowledgeUsed);
  return render(
    <MemoryRouter>
      <KnowledgePage />
    </MemoryRouter>
  );
}

describe("KnowledgePage citations", () => {
  it("shows how many runs leaned on a source", () => {
    renderKnowledge([["k1"], ["k1"], ["k1", "k2"]]);

    expect(within(screen.getByTestId("source-k1")).getByText(/cited 3×/i)).toBeInTheDocument();
    expect(within(screen.getByTestId("source-k2")).getByText(/cited 1×/i)).toBeInTheDocument();
  });

  it("says a source is unused rather than showing nothing", () => {
    renderKnowledge([["k1"]]);

    expect(within(screen.getByTestId("source-k2")).getByText(/not yet used/i)).toBeInTheDocument();
  });
});
