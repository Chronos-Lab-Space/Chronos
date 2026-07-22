import { Link } from "react-router-dom";
import {
  computeWorkspacePulse,
  formatRelativeTime,
} from "../../../../domain/workspace/pulse";
import type { WorkspaceHome } from "../../../../domain/workspace/types";

export function WorkspacePulse({ home }: { home: WorkspaceHome }) {
  const pulse = computeWorkspacePulse(home);
  return (
    <section className="rounded-2xl border border-chronos/30 bg-gradient-to-br from-chronos/10 via-bg-soft/20 to-bg p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-chronos">
            Workspace pulse
          </div>
          <p className="mt-2 text-sm text-ink-dim">
            Working on: <span className="text-ink">{pulse.decisionTitle}</span>
          </p>
        </div>
        <div className="font-mono text-[10px] uppercase text-ink-faint">
          Updated {formatRelativeTime(pulse.lastUpdatedAt)}
        </div>
      </div>

      {/* Recommendation is the pulse, not a metrics wall */}
      <div className="mt-5 rounded-xl border border-chronos/25 bg-bg/70 px-4 py-4">
        <div className="font-mono text-[10px] uppercase text-ink-faint">What to do next</div>
        <p className="mt-2 text-[15px] leading-relaxed text-ink">{pulse.recommendation}</p>
        <Link
          to={pulse.recommendationHref}
          className="mt-4 inline-flex rounded-full bg-ink px-4 py-2 text-sm font-medium text-bg transition hover:bg-chronos"
        >
          Continue →
        </Link>
      </div>

      <dl className="mt-4 grid grid-cols-3 gap-2">
        <Metric label="Knowledge" value={`${pulse.knowledgeCoverage}%`} />
        <Metric label="Confidence" value={`${pulse.simulationConfidence}%`} />
        <Metric label="Open" value={String(pulse.openTasks)} />
      </dl>
    </section>
  );
}

function Metric({
  label,
  value,
  compact,
}: {
  label: string;
  value: string;
  compact?: boolean;
}) {
  return (
    <div className="rounded-xl border border-line bg-bg/50 px-3 py-3">
      <dt className="font-mono text-[9px] uppercase tracking-[0.16em] text-ink-faint">{label}</dt>
      <dd className={`mt-1.5 font-mono tabular-nums text-chronos ${compact ? "text-sm" : "text-2xl"}`}>
        {value}
      </dd>
    </div>
  );
}
