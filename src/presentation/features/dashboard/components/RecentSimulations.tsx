import { Link } from "react-router-dom";
import { confidencePercent, formatCreatedAt } from "../../../../domain/workspace/seed";
import type { SimulationRecord } from "../../../../domain/workspace/types";

/** Supporting list — low visual weight. */
export function RecentSimulations({ simulations }: { simulations: readonly SimulationRecord[] }) {
  const items = simulations.slice(0, 5);
  return (
    <section data-testid="recent-simulations" className="rounded-2xl border border-line p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-faint">
          Recent simulations
        </div>
        <Link to="/workspace/simulations" className="font-mono text-[10px] uppercase text-chronos">
          All →
        </Link>
      </div>
      {items.length === 0 ? (
        <p className="mt-4 text-sm text-ink-dim">
          No runs yet.{" "}
          <Link to="/workspace/simulations?new=1" className="text-chronos">
            Run simulation →
          </Link>
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-line">
          {items.map((s) => (
            <li key={s.id}>
              <Link
                to={`/workspace/simulations/${s.id}`}
                className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm hover:text-chronos"
              >
                <span className="text-ink">{s.title}</span>
                <span className="font-mono text-[10px] uppercase text-ink-faint">
                  {s.status}
                  {s.confidence != null ? ` · ${confidencePercent(s.confidence)}` : ""}
                  {" · "}
                  {formatCreatedAt(s.created_at)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
