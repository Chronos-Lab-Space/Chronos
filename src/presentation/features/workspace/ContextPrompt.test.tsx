import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DEFAULT_PREFERENCES, type UserPreferences } from "../../../domain/workspace/betaChecklist";

const updatePreferences = vi.fn();
const addNote = vi.fn(async (_title: string, _content: string) => {});

function mockWorkspace(preferences: Partial<UserPreferences> = {}) {
  vi.doMock("./WorkspaceContext", () => ({
    useWorkspace: () => ({
      preferences: { ...DEFAULT_PREFERENCES, ...preferences },
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
  it("renders nothing once dismissed for this decision", async () => {
    vi.resetModules();
    mockWorkspace({ contextPromptDismissedFor: ["decision-1"] });
    const { ContextPrompt } = await import("./ContextPrompt");
    const { container } = render(<ContextPrompt decisionId="decision-1" />);

    expect(container).toBeEmptyDOMElement();
  });

  it("asks again on a decision the visitor has not answered for", async () => {
    // One dismissal used to silence the prompt for every decision the visitor
    // would ever open — and with the wizard's context step gone, this is the
    // only in-flow context ask left.
    vi.resetModules();
    mockWorkspace({ contextPromptDismissedFor: ["decision-1"] });
    const { ContextPrompt } = await import("./ContextPrompt");
    render(<ContextPrompt decisionId="decision-2" />);

    expect(screen.getByRole("heading", { name: /add what you know/i })).toBeInTheDocument();
  });

  it("saves what the visitor wrote", async () => {
    // Dismissing on save hides the form either way, so every other assertion
    // here — and the E2E — stays green with the addNote call deleted and the
    // note silently dropped. This is the one that does not.
    vi.resetModules();
    addNote.mockClear();
    mockWorkspace();
    const { ContextPrompt } = await import("./ContextPrompt");
    render(<ContextPrompt decisionId="decision-1" />);

    await userEvent.clear(screen.getByLabelText(/note title/i));
    await userEvent.type(screen.getByLabelText(/note title/i), "Runway");
    await userEvent.type(screen.getByLabelText(/note content/i), "Nine months of cash left.");
    await userEvent.click(screen.getByRole("button", { name: /^save$/i }));

    expect(addNote).toHaveBeenCalledWith("Runway", "Nine months of cash left.");
  });

  it("remembers a dismissal against the decision it was asked about", async () => {
    vi.resetModules();
    updatePreferences.mockClear();
    mockWorkspace({ contextPromptDismissedFor: ["decision-1"] });
    const { ContextPrompt } = await import("./ContextPrompt");
    render(<ContextPrompt decisionId="decision-2" />);

    await userEvent.click(screen.getByRole("button", { name: /not now/i }));

    // Persisted, not component state: the prompt must not return on the next
    // run of this decision — and must not take the earlier answer with it.
    expect(updatePreferences).toHaveBeenCalledWith({
      contextPromptDismissedFor: ["decision-1", "decision-2"],
    });
  });
});
