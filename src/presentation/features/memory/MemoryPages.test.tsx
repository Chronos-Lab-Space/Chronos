import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

// Only the workspace hook matters here — the page under test reads `home`.
const useWorkspace = vi.fn();
vi.mock("../workspace/WorkspaceContext", () => ({
  useWorkspace: () => useWorkspace(),
}));

import { MemoryPage } from "./MemoryPages";

function renderPage() {
  return render(
    <MemoryRouter>
      <MemoryPage />
    </MemoryRouter>
  );
}

describe("MemoryPage during hydration", () => {
  it("still renders the page identity while the workspace is null", () => {
    // `home` is null before the first load resolves. Returning null for that
    // rendered a blank page — the page appeared not to exist on a slow load,
    // and anything navigating straight here raced the hydrate.
    useWorkspace.mockReturnValue({ home: null });

    renderPage();

    expect(screen.getByRole("heading", { name: /history/i })).toBeInTheDocument();
    expect(screen.getByTestId("surface-loading")).toBeInTheDocument();
  });

  it("drops the loading line once the workspace arrives", () => {
    useWorkspace.mockReturnValue({
      home: {
        workspace: { id: "w1", name: "Lab" },
        recentSimulations: [],
        goalHistory: [],
        knowledge: [],
        notes: [],
        futuresBySimulation: {},
        timelineBySimulation: {},
      },
    });

    renderPage();

    expect(screen.getByRole("heading", { name: /history/i })).toBeInTheDocument();
    expect(screen.queryByTestId("surface-loading")).not.toBeInTheDocument();
  });
});
