import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

const useWorkspace = vi.fn();
vi.mock("./WorkspaceContext", () => ({
  useWorkspace: () => useWorkspace(),
}));

import { WorkspaceSettingsPage } from "./WorkspaceSettingsPage";

const home = {
  workspace: { id: "w1", owner_id: "o1", name: "Lab", description: "", created_at: "" },
  goal: null,
  goalHistory: [],
  knowledge: [],
  notes: [],
  recentSimulations: [],
  futuresBySimulation: {},
  timelineBySimulation: {},
};

function renderPage(ownerId: string) {
  useWorkspace.mockReturnValue({
    home,
    ownerId,
    workspaces: [],
    createWorkspace: vi.fn(),
    switchWorkspace: vi.fn(),
    error: null,
    preferences: { shareAcknowledged: false },
    markShareAcknowledged: vi.fn(),
  });
  return render(
    <MemoryRouter>
      <WorkspaceSettingsPage />
    </MemoryRouter>
  );
}

describe("WorkspaceSettingsPage access", () => {
  it("asks an anonymous owner to sign in instead of showing sharing", () => {
    // Sharing and members identify who a workspace belongs to, so this surface
    // needs a real account — but the visitor stays inside the app.
    renderPage("anon-11111111-1111-4111-8111-111111111111");

    expect(screen.getByTestId("settings-requires-account")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /sign in/i })).toHaveAttribute("href", "/login");
  });

  it("shows the real settings surface for a signed-in owner", () => {
    renderPage("22222222-2222-4222-8222-222222222222");

    expect(screen.queryByTestId("settings-requires-account")).not.toBeInTheDocument();
  });
});

describe("WorkspaceSettingsPage export", () => {
  it("offers a JSON and a CSV download that do not throw", async () => {
    URL.createObjectURL = vi.fn(() => "blob:mock");
    URL.revokeObjectURL = vi.fn();
    renderPage("22222222-2222-4222-8222-222222222222");

    await userEvent.click(screen.getByRole("button", { name: "Download JSON" }));
    await userEvent.click(screen.getByRole("button", { name: "Download CSV" }));

    expect(URL.createObjectURL).toHaveBeenCalledTimes(2);
  });
});
