import { Link } from "react-router-dom";
import {
  confidencePercent,
  formatCreatedAt,
} from "../../../../domain/workspace/seed";
import type { SimulationRecord } from "../../../../domain/workspace/types";

type Props = {
  simulations: readonly SimulationRecord[];
};

/** Table-like feed: name, status, confidence, created at. */
export function RecentSimulations({ simulations }: Props) {
  return (
    <section>
      <div className="flex items-baseline justify-between gap-3">
        <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-faint">
          What simulations have I run?
        </div>
        <Link
          to="/workspace/simulations"
          className="font-mono text-[10px] uppercase tracking-[0.16em] text-chronos hover:text-ink"
        >
          All →
        </Link>
      </div>

      <div className="mt-4 -mx-1 overflow-x-auto border-y border-line px-1">
        <table className="w-full min-w-[480px] text-left text-sm sm:min-w-[520px]">
          <thead>
            <tr className="border-b border-line font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint">
              <th className="py-3 pr-3 font-medium">Simulation</th>
              <th className="py-3 pr-3 font-medium">Status</th>
              <th className="py-3 pr-3 font-medium">Confidence</th>
              <th className="py-3 font-medium">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {simulations.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-6 text-ink-dim">
                  No simulations yet.{" "}
                  <Link to="/workspace/simulations?new=1" className="text-chronos hover:text-ink">
                    Run your first simulation →
                  </Link>
                </td>
              </tr>
            ) : (
              simulations.map((sim) => (
                <tr key={sim.id} className="transition-colors duration-200 hover:bg-chronos/5">
                  <td className="py-3 pr-3">
                    <Link to={`/workspace/simulations/${sim.id}`} className="text-ink transition hover:text-chronos">
                      {sim.title || "Untitled"}
                    </Link>
                  </td>
                  <td className="py-3 pr-3 capitalize text-ink-dim">{sim.status}</td>
                  <td className="py-3 pr-3 font-mono text-chronos">
                    {confidencePercent(sim.confidence)}
                  </td>
                  <td className="py-3 text-ink-dim">{formatCreatedAt(sim.created_at)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
