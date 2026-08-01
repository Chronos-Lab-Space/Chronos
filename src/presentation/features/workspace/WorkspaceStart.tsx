import { useState } from "react";
import { useNavigate } from "react-router-dom";
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
  const { createWorkspace, setGoal, runSimulation, error } = useWorkspace();
  const navigate = useNavigate();
  const [decision, setDecision] = useState("");
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const objective = decision.trim();
    if (!objective) {
      setLocalError("What decision are you working on?");
      return;
    }
    setBusy(true);
    setLocalError(null);
    try {
      await createWorkspace(DEFAULT_WORKSPACE_NAME);
      await setGoal(objective);
      const simulationId = await runSimulation(objective);
      // A failed run must not cost the decision — it is saved either way, and
      // the workspace renders with the error rather than an empty start screen.
      if (simulationId) navigate(`/workspace/simulations/${simulationId}`);
    } catch (err) {
      setLocalError((err as Error).message || "Could not start the simulation.");
    } finally {
      setBusy(false);
    }
  };

  const displayError = localError || error;

  return (
    <div className="mx-auto max-w-lg">
      <form onSubmit={submit}>
        <label htmlFor="decision" className="block text-sm font-medium text-ink">
          What are you deciding?
        </label>
        <input
          id="decision"
          value={decision}
          onChange={(e) => setDecision(e.target.value)}
          placeholder="Launch CLAB on Kickstart"
          className="mt-2 w-full rounded-lg border border-line bg-bg px-3 py-2 text-ink"
        />
        {displayError && <p className="mt-2 text-sm text-ink-dim">{displayError}</p>}
        <button
          type="submit"
          disabled={busy}
          className="mt-4 rounded-full border border-chronos/40 bg-chronos/10 px-4 py-2 text-chronos"
        >
          {busy ? "Simulating…" : "Simulate"}
        </button>
      </form>
    </div>
  );
}
