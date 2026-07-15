import { useState } from "react";
import { Link } from "react-router-dom";
import { confidencePercent, knowledgeCounts } from "../../../domain/workspace/seed";
import { useWorkspace } from "./WorkspaceContext";

/**
 * Live HQ once workspace + goal exist. Supports context upload and run simulation.
 */
export function WorkspaceDashboard() {
  const { home, runSimulation, error } = useWorkspace();
  const [objective, setObjective] = useState("");
  const [running, setRunning] = useState(false);
  const [showRun, setShowRun] = useState(false);

  if (!home?.goal) return null;

  const counts = knowledgeCounts(home.knowledge);

  const handleRun = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = objective.trim() || home.goal!.title;
    setRunning(true);
    try {
      await runSimulation(text);
      setObjective("");
      setShowRun(false);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-10">
      {/* Current Goal */}
      <section className="border-b border-line pb-10">
        <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-faint">
          Current goal
        </div>
        <h1 className="mt-3 font-serif text-3xl text-ink sm:text-4xl">{home.goal.title}</h1>
        {home.goal.description ? (
          <p className="mt-3 max-w-xl text-sm text-ink-dim">{home.goal.description}</p>
        ) : null}

        {!showRun ? (
          <button
            type="button"
            onClick={() => setShowRun(true)}
            className="mt-6 inline-flex items-center justify-center rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-bg transition hover:bg-chronos"
          >
            Run Simulation
          </button>
        ) : (
          <form onSubmit={handleRun} className="mt-6 space-y-3">
            <label htmlFor="sim-objective" className="block text-sm font-medium text-ink">
              What should we simulate?
            </label>
            <input
              id="sim-objective"
              value={objective}
              onChange={(e) => setObjective(e.target.value)}
              placeholder={home.goal.title}
              className="w-full rounded-lg border border-line bg-bg px-3 py-2 text-sm text-ink focus:border-chronos focus:outline-none"
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="submit"
                disabled={running}
                className="rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-bg transition hover:bg-chronos disabled:opacity-50"
              >
                {running ? "Simulating…" : "Run"}
              </button>
              <button
                type="button"
                onClick={() => setShowRun(false)}
                className="rounded-full border border-line px-5 py-2.5 text-sm text-ink-dim transition hover:text-ink"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
      </section>

      {/* Quick Actions */}
      <section>
        <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-faint">
          Quick actions
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <ActionChip to="/workspace/simulations?new=1" label="+ Simulation" />
          <ActionChip to="/workspace/knowledge?upload=1" label="+ Upload" />
          <ActionChip to="/workspace/notes?new=1" label="+ Note" />
          <ActionChip to="/workspace/knowledge?import=website" label="+ Import URL" />
        </div>
      </section>

      {/* Recent Simulations */}
      <section>
        <div className="flex items-baseline justify-between gap-3">
          <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-faint">
            Recent simulations
          </div>
          <Link
            to="/workspace/simulations"
            className="font-mono text-[10px] uppercase tracking-[0.16em] text-chronos hover:text-ink"
          >
            All →
          </Link>
        </div>
        <ul className="mt-4 divide-y divide-line border-y border-line">
          {home.recentSimulations.length === 0 ? (
            <li className="py-6 text-sm text-ink-dim">
              No simulations yet. Run one from the goal — it will be here when you return.
            </li>
          ) : (
            home.recentSimulations.map((sim) => (
              <li key={sim.id}>
                <Link
                  to={`/workspace/simulations/${sim.id}`}
                  className="flex items-start justify-between gap-4 py-4 transition hover:text-chronos"
                >
                  <div className="min-w-0">
                    <div className="truncate text-[15px] text-ink">{sim.title || "Untitled run"}</div>
                    <div className="mt-1 text-sm text-ink-dim">
                      {sim.futures_count} futures
                      {sim.best_outcome ? ` · ${sim.best_outcome}` : ""}
                    </div>
                  </div>
                  <div className="shrink-0 font-mono text-[12px] text-chronos">
                    {confidencePercent(sim.confidence)}
                  </div>
                </Link>
              </li>
            ))
          )}
        </ul>
      </section>

      {/* Knowledge */}
      <section>
        <div className="flex items-baseline justify-between gap-3">
          <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-faint">
            Knowledge
          </div>
          <Link
            to="/workspace/knowledge"
            className="font-mono text-[10px] uppercase tracking-[0.16em] text-chronos hover:text-ink"
          >
            Library →
          </Link>
        </div>
        <Link
          to="/workspace/knowledge"
          className="mt-4 block border border-line px-4 py-4 transition hover:border-chronos/40"
        >
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-ink-dim">
            <span>
              <span className="text-ink">{counts.pdfs}</span> PDFs
            </span>
            <span>
              <span className="text-ink">{home.notes.length}</span> Notes
            </span>
            <span>
              <span className="text-ink">{counts.websites}</span> Website
              {counts.websites === 1 ? "" : "s"}
            </span>
            <span>
              <span className="text-ink">{counts.research}</span> Research
            </span>
          </div>
        </Link>
      </section>
    </div>
  );
}

function ActionChip({ to, label }: { to: string; label: string }) {
  return (
    <Link
      to={to}
      className="inline-flex items-center rounded-full border border-line px-4 py-2 text-sm text-ink transition hover:border-chronos/50 hover:text-chronos"
    >
      {label}
    </Link>
  );
}
