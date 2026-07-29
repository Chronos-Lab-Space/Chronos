import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

// Every workspace surface reads `home` from this hook and used to render
// nothing at all while it was null.
const useWorkspace = vi.fn();
vi.mock("./WorkspaceContext", () => ({
  useWorkspace: () => useWorkspace(),
}));
vi.mock("../workspace/WorkspaceContext", () => ({
  useWorkspace: () => useWorkspace(),
}));

import { KnowledgePage, NotesPage } from "../knowledge/KnowledgePages";
import { ComparePage, MemoryPage } from "../memory/MemoryPages";
import { SimulationDetailPage, SimulationsPage } from "../simulation/SimulationPages";
import { WorkspaceSettingsPage } from "./WorkspaceSettingsPage";

const SURFACES: [string, () => React.ReactNode, RegExp][] = [
  ["Simulations", SimulationsPage, /simulations/i],
  ["Simulation detail", SimulationDetailPage, /decision report/i],
  ["Knowledge", KnowledgePage, /library/i],
  ["Notes", NotesPage, /working notes/i],
  ["Memory", MemoryPage, /history/i],
  ["Compare", ComparePage, /compare versions/i],
  ["Settings", WorkspaceSettingsPage, /workspaces/i],
];

describe("workspace surfaces during hydration", () => {
  it.each(SURFACES)(
    "%s renders its identity instead of a blank page while home is null",
    (_name, Page, heading) => {
      // A blank page reads as a broken app. The header must be present and must
      // not move when content arrives.
      useWorkspace.mockReturnValue({ home: null, loading: true });

      render(
        <MemoryRouter>
          <Page />
        </MemoryRouter>
      );

      expect(screen.getByRole("heading", { name: heading })).toBeInTheDocument();
      expect(screen.getByTestId("surface-loading")).toBeInTheDocument();
    }
  );
});
