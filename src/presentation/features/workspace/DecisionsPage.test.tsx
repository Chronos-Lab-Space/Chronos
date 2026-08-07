import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SimulationRecord, WorkspaceHome } from "../../../domain/workspace/types";
import { DecisionsPage } from "./DecisionsPage";

const state = vi.hoisted(() => ({ home: null as WorkspaceHome | null }));

vi.mock("./WorkspaceContext", () => ({
  useWorkspace: () => ({ home: state.home }),
}));

function sim(id: string, title: string): SimulationRecord {
  return {
    id,
    workspace_id: "w1",
    goal_id: null,
    title,
    status: "completed",
    confidence: 0.6,
    result: {},
    created_at: "2026-07-24T00:00:00.000Z",
    version: 1,
    lineage_id: id,
    parent_simulation_id: null,
    decision_id: id,
  };
}

function home(): WorkspaceHome {
  return {
    workspace: { id: "w1", owner_id: "user-1", name: "Lab", description: "", created_at: "" },
    goal: null,
    goalHistory: [],
    decisions: [
      {
        id: "s1",
        workspace_id: "w1",
        title: "Raise or bootstrap?",
        description: "",
        goal_id: null,
        created_at: "2026-07-24T00:00:00.000Z",
      },
      {
        id: "s2",
        workspace_id: "w1",
        title: "Hire a co-founder?",
        description: "",
        goal_id: null,
        created_at: "2026-07-23T00:00:00.000Z",
      },
    ],
    recentSimulations: [sim("s1", "Raise or bootstrap?"), sim("s2", "Hire a co-founder?")],
    knowledge: [],
    notes: [],
    futuresBySimulation: {},
    timelineBySimulation: {},
  };
}

function renderPage() {
  state.home = home();
  return render(
    <MemoryRouter>
      <DecisionsPage />
    </MemoryRouter>
  );
}

describe("DecisionsPage tagging", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("adds a tag to a decision by typing and pressing Enter", async () => {
    renderPage();
    const [firstRow] = screen.getAllByTestId("decision-row");

    const input = within(firstRow).getByPlaceholderText("+ tag");
    await userEvent.type(input, "Funding{Enter}");

    expect(within(firstRow).getByText("Funding")).toBeInTheDocument();
  });

  it("removes a tag", async () => {
    renderPage();
    const [firstRow] = screen.getAllByTestId("decision-row");
    await userEvent.type(within(firstRow).getByPlaceholderText("+ tag"), "Funding{Enter}");

    await userEvent.click(within(firstRow).getByRole("button", { name: /remove tag funding/i }));

    expect(within(firstRow).queryByText("Funding")).not.toBeInTheDocument();
  });

  it("filters the decision list to only rows carrying the active tag", async () => {
    renderPage();
    const [firstRow] = screen.getAllByTestId("decision-row");
    await userEvent.type(within(firstRow).getByPlaceholderText("+ tag"), "Funding{Enter}");

    await userEvent.click(screen.getByRole("button", { name: "Funding" }));

    const visible = screen.getAllByTestId("decision-row");
    expect(visible).toHaveLength(1);
    const [visibleRow] = visible;
    expect(
      within(visibleRow).getByRole("link", { name: "Raise or bootstrap?" })
    ).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Hire a co-founder?" })).not.toBeInTheDocument();
  });

  it("clears the filter when the active tag chip is clicked again", async () => {
    renderPage();
    const [firstRow] = screen.getAllByTestId("decision-row");
    await userEvent.type(within(firstRow).getByPlaceholderText("+ tag"), "Funding{Enter}");
    await userEvent.click(screen.getByRole("button", { name: "Funding" }));
    await userEvent.click(screen.getByRole("button", { name: "Funding" }));

    expect(screen.getAllByTestId("decision-row")).toHaveLength(2);
  });

  it("shows no filter row when nothing is tagged", () => {
    renderPage();
    expect(screen.queryByTestId("decision-tag-filters")).not.toBeInTheDocument();
  });
});
