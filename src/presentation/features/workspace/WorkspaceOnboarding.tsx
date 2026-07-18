import { useState } from "react";
import { useWorkspace } from "./WorkspaceContext";

/**
 * First-run path for the success metric:
 * no workspace → create one → define a goal.
 */
export function WorkspaceOnboarding() {
  const { home, createWorkspace, setGoal, error } = useWorkspace();
  const [name, setName] = useState("");
  const [goalTitle, setGoalTitle] = useState("");
  const [goalDescription, setGoalDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const needsWorkspace = !home;
  const needsGoal = Boolean(home && !home.goal);
  const displayError = localError || error;

  const submitWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setLocalError(null);
    try {
      await createWorkspace(name);
    } catch (err) {
      const msg = (err as Error).message || "Could not create workspace.";
      setLocalError(
        /not signed in/i.test(msg)
          ? "Your session expired or is not ready. Sign in again, then retry."
          : msg
      );
    } finally {
      setBusy(false);
    }
  };

  const submitGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setLocalError(null);
    try {
      await setGoal(goalTitle, goalDescription);
    } catch (err) {
      setLocalError((err as Error).message || "Could not save goal.");
    } finally {
      setBusy(false);
    }
  };

  if (needsWorkspace) {
    return (
      <section className="mx-auto max-w-md">
        <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-chronos">
          Get started
        </div>
        <h1 className="mt-3 font-serif text-3xl text-ink">Create your workspace</h1>
        <p className="mt-3 text-sm text-ink-dim">
          A workspace is your project HQ — goals, context, and simulations live here so you can
          leave and pick up where you stopped.
        </p>
        <form onSubmit={submitWorkspace} className="mt-8 space-y-4">
          <Field
            id="ws-name"
            label="Workspace name"
            value={name}
            onChange={setName}
            placeholder="My project"
          />
          <button
            type="submit"
            disabled={busy || !name.trim()}
            className="w-full rounded-full bg-ink px-4 py-2.5 text-sm font-medium text-bg transition hover:bg-chronos disabled:opacity-50"
          >
            {busy ? "Creating…" : "Create workspace"}
          </button>
          {displayError && <p className="text-sm text-red-400">{displayError}</p>}
        </form>
      </section>
    );
  }

  if (needsGoal) {
    return (
      <section className="mx-auto max-w-md">
        <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-chronos">
          Workspace: {home?.workspace.name}
        </div>
        <h1 className="mt-3 font-serif text-3xl text-ink">Define the current goal</h1>
        <p className="mt-3 text-sm text-ink-dim">
          What decision are you working on? Simulations and knowledge revolve around it.
        </p>
        <form onSubmit={submitGoal} className="mt-8 space-y-4">
          <Field
            id="goal-title"
            label="Goal"
            value={goalTitle}
            onChange={setGoalTitle}
            placeholder="What decision are you trying to make?"
          />
          <div>
            <label htmlFor="goal-desc" className="block text-sm font-medium text-ink">
              Description <span className="text-ink-faint">(optional)</span>
            </label>
            <textarea
              id="goal-desc"
              value={goalDescription}
              onChange={(e) => setGoalDescription(e.target.value)}
              rows={3}
              className="mt-2 w-full rounded-lg border border-line bg-bg px-3 py-2 text-sm text-ink focus:border-chronos focus:outline-none"
              placeholder="What does done look like?"
            />
          </div>
          <button
            type="submit"
            disabled={busy || !goalTitle.trim()}
            className="w-full rounded-full bg-ink px-4 py-2.5 text-sm font-medium text-bg transition hover:bg-chronos disabled:opacity-50"
          >
            {busy ? "Saving…" : "Set goal"}
          </button>
          {displayError && <p className="text-sm text-red-400">{displayError}</p>}
        </form>
      </section>
    );
  }

  return null;
}

function Field({
  id,
  label,
  value,
  onChange,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-ink">
        {label}
      </label>
      <input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required
        placeholder={placeholder}
        className="mt-2 w-full rounded-lg border border-line bg-bg px-3 py-2 text-sm text-ink focus:border-chronos focus:outline-none"
      />
    </div>
  );
}
