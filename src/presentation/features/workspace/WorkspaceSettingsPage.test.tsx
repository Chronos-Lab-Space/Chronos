import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

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

describe("WorkspaceSettingsPage notification toggle", () => {
  const originalNotification = (globalThis as { Notification?: unknown }).Notification;

  afterEach(() => {
    (globalThis as { Notification?: unknown }).Notification = originalNotification;
    localStorage.clear();
  });

  function stubNotification(permission: NotificationPermission) {
    (globalThis as { Notification?: unknown }).Notification = {
      permission,
      requestPermission: vi.fn(async () => permission),
    };
  }

  it("is absent when the browser has no Notification API", () => {
    // `in` checks key presence, not value — the key has to go, not just its value.
    delete (globalThis as { Notification?: unknown }).Notification;
    renderPage("22222222-2222-4222-8222-222222222222");

    expect(screen.queryByText(/browser notifications/i)).not.toBeInTheDocument();
  });

  it("requests permission and enables on click", async () => {
    stubNotification("granted");
    renderPage("22222222-2222-4222-8222-222222222222");

    await userEvent.click(screen.getByRole("button", { name: /notify me when a review is due/i }));

    expect(await screen.findByRole("button", { name: /turn off/i })).toBeInTheDocument();
  });

  it("disables the button and explains a browser-level block", () => {
    stubNotification("denied");
    renderPage("22222222-2222-4222-8222-222222222222");

    expect(screen.getByRole("button", { name: /notify me when a review is due/i })).toBeDisabled();
    expect(screen.getByText(/blocked for this site/i)).toBeInTheDocument();
  });
});
