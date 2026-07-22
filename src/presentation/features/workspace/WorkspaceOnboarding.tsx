import { useState } from "react";
import {
  prepareImportUrl,
  prepareUploadFile,
} from "../../../application/workspace/KnowledgeImport";
import {
  ONBOARDING_STEPS,
  isWorkspaceOnboarded,
  onboardingStepIndex,
  requiredOnboardingStep,
  type OnboardingStep,
} from "../../../domain/workspace/onboarding";
import { useWorkspace } from "./WorkspaceContext";

/**
 * Mandatory path: Create → Name → Goal → Context → Dashboard.
 * No skipping. Frames "What am I working on?"
 */
export function WorkspaceOnboarding() {
  const { home, createWorkspace, setGoal, addKnowledge, addNote, error } = useWorkspace();
  const required = requiredOnboardingStep(home);

  const [localStep, setLocalStep] = useState<"welcome" | "name">("welcome");
  const [name, setName] = useState("Chronos Lab");
  const [goalTitle, setGoalTitle] = useState("");
  const [goalDescription, setGoalDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [contextMode, setContextMode] = useState<"upload" | "url" | "note">("note");
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState("https://");
  const [noteTitle, setNoteTitle] = useState("Decision context");
  const [noteBody, setNoteBody] = useState("");

  if (isWorkspaceOnboarded(home)) return null;

  const active: OnboardingStep =
    required === "welcome" || required === "name"
      ? localStep === "name" || home?.workspace
        ? "name"
        : "welcome"
      : required;

  // If workspace exists but we're still on welcome UI, jump to name done → goal
  const step: OnboardingStep =
    home?.workspace && (active === "welcome" || active === "name")
      ? required === "goal" || required === "context" || required === "dashboard"
        ? required
        : "goal"
      : active === "name" && !home?.workspace
        ? "name"
        : active === "welcome" && !home?.workspace
          ? "welcome"
          : required === "dashboard"
            ? "context"
            : required;

  const displayError = localError || error;
  const stepIdx = onboardingStepIndex(step === "name" ? "name" : step);

  const submitName = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setLocalError("Workspace name is required.");
      return;
    }
    setBusy(true);
    setLocalError(null);
    try {
      await createWorkspace(trimmed);
    } catch (err) {
      const msg = (err as Error).message || "Could not create workspace.";
      setLocalError(
        /not signed in/i.test(msg)
          ? "Your session expired. Sign in again, then retry."
          : msg
      );
    } finally {
      setBusy(false);
    }
  };

  const submitGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!goalTitle.trim()) {
      setLocalError("What decision are you working on?");
      return;
    }
    setBusy(true);
    setLocalError(null);
    try {
      await setGoal(goalTitle.trim(), goalDescription);
    } catch (err) {
      setLocalError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const submitContext = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setLocalError(null);
    try {
      if (contextMode === "upload") {
        if (!file) {
          setLocalError("Choose a PDF, Markdown, or TXT file.");
          return;
        }
        await addKnowledge(await prepareUploadFile(file));
      } else if (contextMode === "url") {
        const prepared = await prepareImportUrl(url);
        await addKnowledge(prepared);
      } else {
        if (!noteTitle.trim() || !noteBody.trim()) {
          setLocalError("Note title and content are required.");
          return;
        }
        await addNote(noteTitle.trim(), noteBody.trim());
      }
    } catch (err) {
      setLocalError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-lg">
      <ol className="flex flex-wrap items-center gap-1.5">
        {ONBOARDING_STEPS.map((s, i) => (
          <li key={s} className="flex items-center gap-1.5">
            {i > 0 && <span className="text-ink-faint">→</span>}
            <span
              className={`rounded-full px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.12em] ${
                i === stepIdx
                  ? "bg-chronos/20 text-chronos"
                  : i < stepIdx
                    ? "text-chronos/70"
                    : "text-ink-faint"
              }`}
            >
              {i < stepIdx ? "✓ " : ""}
              {s}
            </span>
          </li>
        ))}
      </ol>
      <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-faint">
        Required path · no skipping
      </p>

      <div className="mt-8">
        {step === "welcome" && (
          <section>
            <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-chronos">
              Step 1 · Create workspace
            </div>
            <h1 className="mt-3 font-serif text-3xl text-ink">Create Workspace</h1>
            <p className="mt-4 text-[15px] text-ink-dim">
              Chronos does not ask <span className="italic">“What do you want to ask?”</span>
            </p>
            <p className="mt-2 text-[15px] text-ink">
              It asks: <span className="text-chronos">What am I working on?</span>
            </p>
            <button
              type="button"
              onClick={() => setLocalStep("name")}
              className="mt-8 w-full rounded-full bg-ink px-4 py-3 text-sm font-medium text-bg hover:bg-chronos"
            >
              Begin →
            </button>
          </section>
        )}

        {step === "name" && (
          <section>
            <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-chronos">
              Step 2 · Workspace name
            </div>
            <h1 className="mt-3 font-serif text-3xl text-ink">Name this workspace</h1>
            <form onSubmit={submitName} className="mt-8 space-y-4">
              <Field id="ws-name" label="Workspace name" value={name} onChange={setName} />
              <button
                type="submit"
                disabled={busy || !name.trim()}
                className="w-full rounded-full bg-ink px-4 py-3 text-sm font-medium text-bg hover:bg-chronos disabled:opacity-50"
              >
                {busy ? "Creating…" : "Continue →"}
              </button>
              {displayError && <p className="text-sm text-red-400">{displayError}</p>}
            </form>
          </section>
        )}

        {step === "goal" && (
          <section>
            <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-chronos">
              Step 3 · {home?.workspace.name}
            </div>
            <h1 className="mt-3 font-serif text-3xl text-ink">
              What are you trying to decide?
            </h1>
            <p className="mt-2 text-sm text-ink-dim">
              Create your first decision — Chronos will simulate futures against it.
            </p>
            <form onSubmit={submitGoal} className="mt-8 space-y-4">
              <Field
                id="goal"
                label="First decision"
                value={goalTitle}
                onChange={setGoalTitle}
                placeholder="Launch CLAB on Kickstart"
              />
              <div>
                <label className="block text-sm text-ink" htmlFor="gdesc">
                  What does done look like?
                </label>
                <textarea
                  id="gdesc"
                  value={goalDescription}
                  onChange={(e) => setGoalDescription(e.target.value)}
                  rows={3}
                  className="mt-2 w-full rounded-lg border border-line bg-bg px-3 py-2 text-sm text-ink focus:border-chronos focus:outline-none"
                />
              </div>
              <button
                type="submit"
                disabled={busy || !goalTitle.trim()}
                className="w-full rounded-full bg-ink px-4 py-3 text-sm font-medium text-bg hover:bg-chronos disabled:opacity-50"
              >
                {busy ? "Saving…" : "Continue →"}
              </button>
              {displayError && <p className="text-sm text-red-400">{displayError}</p>}
            </form>
          </section>
        )}

        {step === "context" && (
          <section>
            <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-chronos">
              Step 4 · Upload context
            </div>
            <h1 className="mt-3 font-serif text-3xl text-ink">Add context</h1>
            <p className="mt-2 text-sm text-ink-dim">
              At least one doc, URL, or note before the dashboard unlocks.
            </p>
            {home?.goal && (
              <p className="mt-4 rounded-xl border border-line px-4 py-3 text-sm">
                <span className="font-mono text-[10px] uppercase text-ink-faint">Working on</span>
                <span className="mt-1 block font-serif text-lg">{home.goal.title}</span>
              </p>
            )}
            <div className="mt-6 flex flex-wrap gap-2">
              {(["upload", "url", "note"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setContextMode(m)}
                  className={`rounded-full px-3 py-1.5 font-mono text-[10px] uppercase ${
                    contextMode === m ? "bg-chronos/20 text-chronos" : "border border-line text-ink-faint"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
            <form onSubmit={submitContext} className="mt-6 space-y-4">
              {contextMode === "upload" && (
                <input
                  type="file"
                  accept=".pdf,.md,.txt"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  className="block w-full text-sm text-ink-dim"
                />
              )}
              {contextMode === "url" && (
                <Field id="url" label="URL" value={url} onChange={setUrl} />
              )}
              {contextMode === "note" && (
                <>
                  <Field id="nt" label="Note title" value={noteTitle} onChange={setNoteTitle} />
                  <textarea
                    value={noteBody}
                    onChange={(e) => setNoteBody(e.target.value)}
                    rows={5}
                    required
                    placeholder="Facts, constraints, assumptions…"
                    className="w-full rounded-lg border border-line bg-bg px-3 py-2 text-sm text-ink focus:border-chronos focus:outline-none"
                  />
                </>
              )}
              <button
                type="submit"
                disabled={busy}
                className="w-full rounded-full bg-ink px-4 py-3 text-sm font-medium text-bg hover:bg-chronos disabled:opacity-50"
              >
                {busy ? "Adding…" : "Add context & open dashboard →"}
              </button>
              {displayError && <p className="text-sm text-red-400">{displayError}</p>}
            </form>
          </section>
        )}
      </div>
    </div>
  );
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
        className="mt-2 w-full rounded-lg border border-line bg-bg px-3 py-2.5 text-sm text-ink focus:border-chronos focus:outline-none"
      />
    </div>
  );
}
