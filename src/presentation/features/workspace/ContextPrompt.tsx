import { useState } from "react";
import {
  dismissContextPromptFor,
  isContextPromptDismissed,
} from "../../../domain/workspace/contextPrompt";
import { useWorkspace } from "./WorkspaceContext";

/**
 * Asks for a source *after* a recommendation exists, where a note is
 * motivated by something the visitor has just read. Onboarding used to ask
 * first, which is why it was skippable and mostly skipped.
 *
 * Once per decision: what the visitor knows about launching in September is
 * not what they know about their next hire.
 */
export function ContextPrompt({
  decisionId,
  objective,
  decisionCreatedAt,
}: {
  decisionId: string;
  objective?: string;
  /** Lets a legacy global dismissal cover everything that predates it. */
  decisionCreatedAt?: string;
}) {
  const { preferences, updatePreferences, addNote, researchObjective } = useWorkspace();
  const [title, setTitle] = useState("Decision context");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [researching, setResearching] = useState(false);
  const [researchNotice, setResearchNotice] = useState<string | null>(null);

  if (isContextPromptDismissed(preferences, decisionId, decisionCreatedAt)) return null;

  const dismiss = () => updatePreferences(dismissContextPromptFor(preferences, decisionId));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!body.trim()) return;
    setBusy(true);
    try {
      await addNote(title.trim() || "Decision context", body.trim());
      // Saving implies the ask is answered — no separate dismissal step.
      dismiss();
    } finally {
      setBusy(false);
    }
  };

  const research = async () => {
    if (!objective) return;
    setResearching(true);
    setResearchNotice(null);
    try {
      const result = await researchObjective(objective);
      // Offline, the research agent returns a stub with no findings. Saying so
      // beats silence, which would read as "done". Source is always labelled.
      setResearchNotice(
        result.findings > 0
          ? `Added ${result.findings} findings as a note (${result.source === "ai" ? "AI" : "stub — no model"}).`
          : "No research available — needs a configured AI provider (or the model returned nothing)."
      );
    } finally {
      setResearching(false);
    }
  };

  return (
    <section className="rounded-2xl border border-line bg-bg-soft p-5 sm:p-6">
      <h2 className="font-serif text-xl text-ink">Add what you know</h2>
      <p className="mt-1 text-sm text-ink-dim">
        Facts, constraints, assumptions — anything that argues with the recommendation above.
        Chronos weighs it on the next run.
      </p>
      <form onSubmit={save} className="mt-4 space-y-2">
        <input
          aria-label="Note title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full rounded-lg border border-line bg-bg px-3 py-2 text-sm text-ink"
        />
        <textarea
          aria-label="Note content"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={3}
          placeholder="What should Chronos know about this decision?"
          className="w-full rounded-lg border border-line bg-bg px-3 py-2 text-sm text-ink"
        />
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={busy || !body.trim()}
            className="rounded-full bg-ink px-4 py-2 text-sm text-bg transition hover:bg-chronos disabled:opacity-50"
          >
            {busy ? "Saving…" : "Save"}
          </button>
          {objective && (
            <button
              type="button"
              onClick={research}
              disabled={researching}
              className="rounded-full border border-line px-4 py-2 text-sm text-ink-dim transition hover:border-chronos/50 hover:text-chronos disabled:opacity-50"
            >
              {researching ? "Researching…" : "Research this"}
            </button>
          )}
          <button
            type="button"
            onClick={dismiss}
            className="rounded-full border border-line px-4 py-2 text-sm text-ink-dim hover:border-chronos/50 hover:text-chronos"
          >
            Not now
          </button>
        </div>
        {researchNotice && (
          <p role="status" className="text-sm text-ink-dim">
            {researchNotice}
          </p>
        )}
      </form>
    </section>
  );
}
