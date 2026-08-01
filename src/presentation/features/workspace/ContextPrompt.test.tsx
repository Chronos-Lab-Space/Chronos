import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

const updatePreferences = vi.fn();
const addNote = vi.fn(async (_title: string, _content: string) => {});

function mockWorkspace(contextPromptDismissed: boolean) {
  vi.doMock("./WorkspaceContext", () => ({
    useWorkspace: () => ({
      preferences: { contextPromptDismissed },
      updatePreferences,
      addNote,
      addKnowledge: vi.fn(async () => {}),
    }),
  }));
}

// `useWorkspace` throws outside a `WorkspaceProvider`, so every test needs its
// own mocked "./WorkspaceContext" module. `vi.doMock` only affects imports
// that happen *after* it runs, and the module registry caches "./ContextPrompt"
// once loaded — so a static top-of-file import would forever bind to whichever
// mock (or the real, throwing module) was active first. Reset the module
// registry and re-import dynamically in each test instead.
describe("ContextPrompt", () => {
  it("renders nothing once dismissed", async () => {
    vi.resetModules();
    mockWorkspace(true);
    const { ContextPrompt } = await import("./ContextPrompt");
    const { container } = render(<ContextPrompt />);

    expect(container).toBeEmptyDOMElement();
  });

  it("saves what the visitor wrote", async () => {
    // Dismissing on save hides the form either way, so every other assertion
    // here — and the E2E — stays green with the addNote call deleted and the
    // note silently dropped. This is the one that does not.
    vi.resetModules();
    addNote.mockClear();
    mockWorkspace(false);
    const { ContextPrompt } = await import("./ContextPrompt");
    render(<ContextPrompt />);

    await userEvent.clear(screen.getByLabelText(/note title/i));
    await userEvent.type(screen.getByLabelText(/note title/i), "Runway");
    await userEvent.type(screen.getByLabelText(/note content/i), "Nine months of cash left.");
    await userEvent.click(screen.getByRole("button", { name: /^save$/i }));

    expect(addNote).toHaveBeenCalledWith("Runway", "Nine months of cash left.");
  });

  it("remembers a dismissal", async () => {
    vi.resetModules();
    mockWorkspace(false);
    const { ContextPrompt } = await import("./ContextPrompt");
    render(<ContextPrompt />);

    await userEvent.click(screen.getByRole("button", { name: /not now/i }));

    // Persisted, not component state: the prompt must not return on the next
    // simulation the visitor opens.
    expect(updatePreferences).toHaveBeenCalledWith({ contextPromptDismissed: true });
  });
});
