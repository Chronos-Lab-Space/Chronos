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
      <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Metric label="Knowledge coverage" value={`${pulse.knowledgeCoverage}%`} />
        <Metric label="Simulation confidence" value={`${pulse.simulationConfidence}%`} />
        <Metric label="Open tasks" value={String(pulse.openTasks)} />
        <Metric label="Last updated" value={formatRelativeTime(pulse.lastUpdatedAt)} compact />
      </dl>
      <div className="mt-6 rounded-xl border border-line bg-bg/60 px-4 py-4">
        <div className="font-mono text-[10px] uppercase text-ink-faint">Recommendation</div>
        <p className="mt-2 text-[15px] text-ink">{pulse.recommendation}</p>
        <Link
          to={pulse.recommendationHref}
          className="mt-3 inline-flex font-mono text-[11px] uppercase tracking-[0.16em] text-chronos"
        >
          Continue →
        </Link>
      </div>
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
