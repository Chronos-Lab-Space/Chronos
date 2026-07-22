import { Link } from "react-router-dom";
import { confidencePercent, formatCreatedAt } from "../../../../domain/workspace/seed";
import type { SimulationRecord } from "../../../../domain/workspace/types";

export function LatestSimulationCard({ simulation }: { simulation: SimulationRecord | null }) {
  if (!simulation) {
    return (
      <Link
        to="/workspace/simulations?new=1"
        className="block rounded-2xl border border-dashed border-line p-5 hover:border-chronos/40 sm:p-6"
      >
        <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-faint">
          Simulation card
        </div>
        <p className="mt-3 text-sm text-ink-dim">No runs yet. Start a simulation to rank futures.</p>
        <span className="mt-4 inline-flex font-mono text-[11px] uppercase text-chronos">
          Run Simulation →
        </span>
      </Link>
    );
  }

  const best =
    (typeof simulation.result.chosen_future_name === "string" &&
      simulation.result.chosen_future_name) ||
    (typeof simulation.result.best_future === "string" && simulation.result.best_future) ||
    "—";

  return (
    <Link
      to={`/workspace/simulations/${simulation.id}`}
      className="group block rounded-2xl border border-line p-5 hover:border-chronos/40 sm:p-6"
    >
      <div className="flex justify-between gap-3">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-faint">
            Simulation card
          </div>
          <h2 className="mt-2 text-lg text-ink group-hover:text-chronos">{simulation.title}</h2>
          <p className="mt-1 text-xs text-ink-faint">
            {formatCreatedAt(simulation.created_at)} · v{simulation.version}
          </p>
        </div>
        <span className="font-mono text-[10px] uppercase text-chronos">Open Simulation →</span>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-line px-4 py-3">
          <div className="font-mono text-[10px] uppercase text-ink-faint">Best / chosen</div>
          <div className="mt-1 font-serif text-xl text-ink">{best}</div>
        </div>
        <div className="rounded-xl border border-line px-4 py-3">
          <div className="font-mono text-[10px] uppercase text-ink-faint">Confidence</div>
          <div className="mt-1 font-mono text-2xl text-chronos">
            {confidencePercent(simulation.confidence)}
          </div>
        </div>
      </div>
    </Link>
  );
}
