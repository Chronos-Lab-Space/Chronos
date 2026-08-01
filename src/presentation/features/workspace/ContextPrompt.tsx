import { useState } from "react";
import { useWorkspace } from "./WorkspaceContext";

/**
 * Asks for a source *after* a recommendation exists, where a note is
 * motivated by something the visitor has just read. Onboarding used to ask
 * first, which is why it was skippable and mostly skipped.
 */
export function ContextPrompt() {
  const { preferences, updatePreferences, addNote } = useWorkspace();
  const [title, setTitle] = useState("Decision context");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);

  if (preferences.contextPromptDismissed) return null;

  const dismiss = () => updatePreferences({ contextPromptDismissed: true });

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
          <button
            type="button"
            onClick={dismiss}
            className="rounded-full border border-line px-4 py-2 text-sm text-ink-dim hover:border-chronos/50 hover:text-chronos"
          >
            Not now
          </button>
        </div>
      </form>
    </section>
  );
}
