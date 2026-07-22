import { Link } from "react-router-dom";
import { confidencePercent } from "../../../../domain/workspace/seed";
import { futureCardLabel } from "../../../../domain/workspace/timeline";
import type { FutureRecord, SimulationRecord } from "../../../../domain/workspace/types";

export function TimelinePreview({
  latest,
  futures,
}: {
  latest: SimulationRecord | null;
  futures: readonly FutureRecord[];
}) {
  return (
    <Link
      to="/workspace/timeline"
      className="group block rounded-2xl border border-line p-5 hover:border-chronos/40 sm:p-6"
    >
      <div className="flex justify-between">
        <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-faint">
          Timeline card
        </div>
        <span className="font-mono text-[10px] uppercase text-chronos">Timeline →</span>
      </div>
      {!latest || futures.length === 0 ? (
        <p className="mt-3 text-sm text-ink-dim">Goal → Future A → B → C after a simulation.</p>
      ) : (
        <div className="mt-5 space-y-0">
          {futures.slice(0, 3).map((f, i) => (
            <div key={f.id}>
              {i > 0 && <div className="flex justify-center py-1 text-ink-faint">↓</div>}
              <div className="flex items-center justify-between rounded-xl border border-line px-3 py-2.5">
                <div>
                  <div className="font-mono text-[9px] uppercase text-ink-faint">
                    Future {futureCardLabel(i)}
                    {i === 0 ? " ⭐" : ""}
                  </div>
                  <div className="truncate text-sm text-ink">{f.name}</div>
                </div>
                <span className="font-mono text-sm text-chronos">
                  {confidencePercent(f.confidence)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </Link>
  );
}
