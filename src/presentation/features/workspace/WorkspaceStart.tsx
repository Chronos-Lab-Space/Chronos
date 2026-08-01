import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { assessObjectiveScope } from "../../../domain/chronos/objectiveScope";
import { useWorkspace } from "./WorkspaceContext";

/** Name for the container, not the decision — a workspace outlives its first one. */
const DEFAULT_WORKSPACE_NAME = "My workspace";

/**
 * First screen a visitor meets. One field, one action, then a ranked result.
 * The wizard this replaced asked for a welcome, a workspace name, and a
 * source before the decision — the product's own docstring recorded that as
 * "four forms between a new user and their first simulation".
 */
export function WorkspaceStart() {
  const {
    home,
    createWorkspace,
    setGoal,
    runSimulation,
    entrySubmitting,
    setEntrySubmitting,
    reportError,
  } = useWorkspace();
  const navigate = useNavigate();
  const [decision, setDecision] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  // Live, so the warning appears while typing rather than on a rejected
  // submit. Empty is "not yet answered", not "out of scope" — the submit
  // below covers that.
  const outOfScope = decision.trim().length > 0 && !assessObjectiveScope(decision).inScope;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const objective = decision.trim();
    if (!objective) {
      setLocalError("What decision are you working on?");
      return;
    }
    // The catalog is startup scenarios only. Running anyway would rank
    // "Bottom-up SaaS" against an objective it cannot model — and this is the
    // first screen of the product, so it is where that has to be said.
    if (outOfScope) return;
    // Holds this screen up for the whole submit. `setGoal` below makes the
    // workspace "onboarded", and without the hold the shell replaced this
    // screen right there — mid-run, with a "run your first simulation" CTA.
    setEntrySubmitting(true);
    setLocalError(null);
    try {
      // A first-time visitor has no workspace yet. createWorkspace never
      // overwrites an existing one, so a returning visitor (workspace already
      // set) skips straight to setGoal instead of getting a second, empty one.
      if (!home?.workspace?.id) {
        await createWorkspace(DEFAULT_WORKSPACE_NAME);
      }
      await setGoal(objective);
      const simulationId = await runSimulation(objective);
      if (simulationId) {
        navigate(`/workspace/simulations/${simulationId}`);
      } else {
        // A run that produced no simulation. Reported through the workspace,
        // not local state: the decision is saved either way, so this screen
        // gives way as soon as the hold releases and takes its own state with
        // it. The shell renders the workspace error above whatever replaces us.
        reportError("Could not start the simulation.");
      }
    } catch (err) {
      reportError((err as Error).message || "Could not start the simulation.");
    } finally {
      setEntrySubmitting(false);
    }
  };

  const describedBy =
    [outOfScope ? "decision-scope" : null, localError ? "decision-error" : null]
      .filter(Boolean)
      .join(" ") || undefined;

  return (
    <div className="mx-auto max-w-lg">
      <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-faint">
        Chronos
      </div>
      <h1 className="mt-2 font-serif text-3xl text-ink">What are you deciding?</h1>
      <p className="mt-2 text-sm text-ink-dim">
        One question, one run. Chronos generates the ways it could go, ranks them, and says which
        one it would take.
      </p>
      <form onSubmit={submit} className="mt-6">
        {/* The heading asks the question; repeating it above the field would
            say the same thing twice, but the field still needs a name. */}
        <label htmlFor="decision" className="sr-only">
          What are you deciding?
        </label>
        <input
          id="decision"
          value={decision}
          onChange={(e) => setDecision(e.target.value)}
          placeholder="Launch CLAB on Kickstart"
          aria-invalid={outOfScope || Boolean(localError)}
          aria-describedby={describedBy}
          className="w-full rounded-lg border border-line bg-bg px-3 py-2 text-ink focus:border-chronos focus:outline-none"
        />
        {outOfScope && (
          <p
            id="decision-scope"
            role="status"
            className="mt-2 rounded-lg border border-line bg-bg-soft p-3 text-sm text-ink-dim"
          >
            Chronos models <strong className="text-ink">startup and business decisions</strong> —
            funding, go-to-market, pricing, hiring, product strategy. This one does not look like
            one, and the simulator would rank go-to-market scenarios that do not fit it. Rephrase it
            as a business decision to continue.
          </p>
        )}
        {localError && (
          <p id="decision-error" role="alert" className="mt-2 text-sm text-ink-dim">
            {localError}
          </p>
        )}
        <button
          type="submit"
          disabled={entrySubmitting || outOfScope}
          className="mt-4 rounded-full border border-chronos/40 bg-chronos/10 px-4 py-2 text-chronos disabled:opacity-50"
        >
          {entrySubmitting ? "Simulating…" : "Simulate"}
        </button>
      </form>
    </div>
  );
}
