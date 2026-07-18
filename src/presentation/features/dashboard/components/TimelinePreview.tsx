import { Link } from "react-router-dom";
import { confidencePercent } from "../../../../domain/workspace/seed";
import type { SimulationRecord } from "../../../../domain/workspace/types";

type Props = {
  latest: SimulationRecord | null;
};

/** Compact preview → opens card timeline on the simulation. */
export function TimelinePreview({ latest }: Props) {
  if (!latest) {
    return (
      <section className="border border-line p-5">
        <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-faint">
          Timeline preview
        </div>
        <p className="mt-3 text-sm text-ink-dim">
          Future cards appear after your first run.
        </p>
        <Link
          to="/workspace/simulations?new=1"
          className="mt-4 inline-flex font-mono text-[11px] uppercase tracking-[0.16em] text-chronos transition hover:text-ink"
        >
          Run simulation →
        </Link>
      </section>
    );
  }

  const topFuture =
    (typeof latest.result.best_future === "string" && latest.result.best_future) ||
    "—";

  return (
    <section className="border border-line p-5">
      <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-faint">
        Timeline preview
      </div>
      <p className="mt-2 text-xs text-ink-faint">Cards · not a graph yet</p>
      <dl className="mt-4 space-y-3">
        <Row label="Latest simulation" value={latest.title} />
        <Row label="Future A ⭐" value={topFuture} />
        <Row label="Confidence" value={confidencePercent(latest.confidence)} accent />
      </dl>
      <Link
        to={`/workspace/simulations/${latest.id}`}
        className="mt-5 inline-flex font-mono text-[11px] uppercase tracking-[0.16em] text-chronos transition hover:text-ink"
      >
        Open cards →
      </Link>
    </section>
  );
}

function Row({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line pb-3 last:border-0 last:pb-0">
      <dt className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint">{label}</dt>
      <dd className={`text-right text-sm ${accent ? "text-chronos" : "text-ink"}`}>{value}</dd>
    </div>
  );
}
