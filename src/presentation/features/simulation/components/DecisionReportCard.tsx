import { Link } from "react-router-dom";
import {
  exportDecisionReportMarkdown,
  type DecisionReport,
} from "../../../../domain/workspace/decisionReport";
import { confidencePercent } from "../../../../domain/workspace/seed";
import type { WorkspaceHome } from "../../../../domain/workspace/types";
import { trackProductEvent } from "../../../../infrastructure/analytics/productAnalytics";
import { ConfidenceCaveatNote } from "../../memory/components/ConfidenceCaveatNote";

type Props = {
  report: DecisionReport;
  compact?: boolean;
  href?: string;
  /** Workspace home for measured confidence caveat (slice 3). */
  home?: WorkspaceHome;
  /** Optional outcome-tracking block rendered after save decision */
  outcomeSlot?: React.ReactNode;
  /** Decide hard-gate actions */
  onSaveDecision?: () => void;
  onCompare?: () => void;
  onRerun?: () => void;
  saveBusy?: boolean;
};

/**
 * Decision Report — result page contract:
 * Goal → Summary → Evidence → Recommendation → Why → Expected Value →
 * (Compare is page-level) → Next → Save Decision → Memory
 */
export function DecisionReportCard({
  report,
  compact,
  href,
  home,
  outcomeSlot,
  onSaveDecision,
  onCompare,
  onRerun,
  saveBusy,
}: Props) {
  const conf = confidencePercent(report.confidence);

  const markExported = () => {
    trackProductEvent("report_exported", {
      simulationId: report.simulationId,
      format: "markdown",
    });
  };

  const copy = async () => {
    const md = exportDecisionReportMarkdown(report);
    try {
      await navigator.clipboard.writeText(md);
      markExported();
    } catch {
      /* ignore */
    }
  };

  const download = () => {
    const md = exportDecisionReportMarkdown(report);
    if (typeof document === "undefined") return;
    const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `decision-report-${report.simulationId.slice(0, 8)}.md`;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    markExported();
  };

  const summaryLine = [
    report.summary.strategiesGenerated != null
      ? `${report.summary.strategiesGenerated} strategies`
      : null,
    report.summary.pathsEvaluated != null
      ? `${report.summary.pathsEvaluated} paths evaluated`
      : null,
    report.summary.disqualifiedCount != null && report.summary.disqualifiedCount > 0
      ? `${report.summary.disqualifiedCount} disqualified`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <article
      className="overflow-hidden rounded-2xl border border-chronos/40 bg-bg"
      data-testid="decision-report"
    >
      <div className="border-b border-line bg-chronos/10 px-5 py-3 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-chronos">
            Decision report
          </div>
          <div className="font-mono text-[10px] uppercase text-ink-faint">
            {report.pathSaved ? "Path saved" : "Engine recommendation"}
          </div>
        </div>
      </div>

      <div className="divide-y divide-line">
        {/* 1 · Goal */}
        <section className="px-5 py-5 sm:px-6">
          <div className="font-mono text-[10px] uppercase text-ink-faint">Goal</div>
          <p className="mt-3 font-serif text-xl text-ink sm:text-2xl">{report.decisionTitle}</p>
          <p className="mt-2 text-[15px] text-ink-dim">{report.objective}</p>
          {report.objectiveDescription ? (
            <p className="mt-2 text-sm text-ink-dim">{report.objectiveDescription}</p>
          ) : null}
        </section>

        {/* 2 · Simulation summary */}
        <section className="px-5 py-5 sm:px-6" data-testid="simulation-summary">
          <div className="font-mono text-[10px] uppercase text-ink-faint">Simulation summary</div>
          <p className="mt-3 text-[15px] text-ink">{summaryLine || "Simulation completed"}</p>
        </section>

        {/* 3 · Evidence */}
        <section className="px-5 py-5 sm:px-6" data-testid="decision-evidence">
          <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-chronos">
            Evidence
          </div>
          <dl className="mt-4 grid gap-3 sm:grid-cols-3">
            <Stat
              label="Knowledge sources used"
              value={String(report.evidence.knowledgeSourcesUsed)}
            />
            <Stat
              label="Constraints evaluated"
              value={String(report.evidence.constraintsEvaluated)}
            />
            <Stat
              label="Strategies generated"
              value={String(report.evidence.strategiesGenerated)}
            />
          </dl>
          <div className="mt-5 font-mono text-[10px] uppercase text-ink-faint">
            Evaluation criteria
          </div>
          <ul className="mt-2 flex flex-wrap gap-2">
            {report.evidence.criteria.map((c) => (
              <li
                key={c.id}
                className={`rounded-full px-3 py-1 text-sm ${
                  c.evaluated
                    ? "border border-chronos/30 bg-chronos/10 text-ink"
                    : "border border-line text-ink-faint"
                }`}
              >
                {c.evaluated ? "✓ " : "— "}
                {c.label}
              </li>
            ))}
          </ul>
          {!compact && report.contextUsed.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {report.contextUsed.map((c) => (
                <span
                  key={c.id}
                  className="rounded-full border border-line px-3 py-1.5 text-sm text-ink"
                >
                  <span className="font-mono text-[10px] uppercase text-ink-faint">{c.type}</span>{" "}
                  {c.title}
                </span>
              ))}
            </div>
          )}
        </section>

        {/* 4 · Recommendation */}
        <section className="px-5 py-6 sm:px-6">
          <div className="font-mono text-[10px] uppercase text-ink-faint">Recommendation</div>
          <h2
            className={`mt-3 font-serif text-ink ${compact ? "text-2xl" : "text-3xl sm:text-4xl"}`}
          >
            {report.recommended}
            <span className="ml-2 text-chronos" aria-hidden>
              ⭐
            </span>
          </h2>
          {report.narrative.map((paragraph) => (
            <p
              key={paragraph}
              className="mt-3 max-w-2xl font-serif text-[15px] leading-relaxed text-ink-dim"
            >
              {paragraph}
            </p>
          ))}
          <div className="mt-5">
            <div className="font-mono text-[10px] uppercase text-ink-faint">Confidence</div>
            <div className="mt-1 font-mono text-4xl text-chronos sm:text-5xl">{conf}</div>
            {home && (
              <ConfidenceCaveatNote home={home} confidence={report.confidence} className="mt-2" />
            )}
          </div>
        </section>

        {/* 5 · Why */}
        <section className="px-5 py-5 sm:px-6">
          <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-chronos">
            Why this was chosen
          </div>
          <ul className="mt-3 space-y-2">
            {(report.recommendedBecause.length
              ? report.recommendedBecause
              : report.why.slice(0, 4)
            ).map((r) => (
              <li key={r} className="flex gap-2.5 text-[15px] text-ink">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-chronos" />
                <span>{r}</span>
              </li>
            ))}
          </ul>
          {!compact && report.why.length > 0 && (
            <ul className="mt-4 grid gap-2 sm:grid-cols-2">
              {report.why.map((w) => (
                <li
                  key={w}
                  className="rounded-xl border border-line px-4 py-3 text-sm text-ink-dim"
                >
                  {w}
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* 6 · Expected value */}
        <section className="px-5 py-5 sm:px-6" data-testid="expected-value">
          <div className="font-mono text-[10px] uppercase text-ink-faint">Expected value</div>
          {report.expectedValue.rows.length ? (
            <dl className="mt-4 space-y-2">
              {report.expectedValue.rows.map((row) => (
                <div
                  key={row.id}
                  className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line/60 pb-2 last:border-0"
                >
                  <dt className="text-sm text-ink-dim">{row.label}</dt>
                  <dd className="font-mono text-sm text-chronos">{row.value}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="mt-3 text-sm text-ink-dim">Insufficient signals to estimate value.</p>
          )}
          {report.expectedValue.reason ? (
            <p className="mt-4 text-sm text-ink-dim">
              <span className="font-mono text-[10px] uppercase text-ink-faint">Reason · </span>
              {report.expectedValue.reason}
            </p>
          ) : null}
        </section>

        {/* 7 · Risks */}
        <section className="px-5 py-5 sm:px-6">
          <div className="font-mono text-[10px] uppercase text-ink-faint">Risks</div>
          <ul className="mt-4 space-y-2">
            {(report.risks.length ? report.risks : ["No major risks flagged."]).map((r) => (
              <li key={r} className="flex gap-3 text-[15px] text-ink-dim">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent-2" />
                {r}
              </li>
            ))}
          </ul>
        </section>

        {/* 8 · Next actions */}
        <section className="px-5 py-5 sm:px-6">
          <div className="font-mono text-[10px] uppercase text-ink-faint">Next actions</div>
          <ul className="mt-4 space-y-2">
            {report.nextActions.map((a) => (
              <li key={a} className="flex gap-3 text-[15px] text-ink">
                <span className="text-chronos">•</span>
                {a}
              </li>
            ))}
          </ul>
        </section>

        {/* 9 · Save decision (hard-gate) */}
        <section className="px-5 py-5 sm:px-6" data-testid="save-decision">
          <div className="font-mono text-[10px] uppercase text-ink-faint">Save decision</div>
          {report.pathSaved ? (
            <p className="mt-3 text-sm text-chronos">Path saved to workspace memory.</p>
          ) : (
            <p className="mt-3 text-sm text-ink-dim">
              Chronos recommends — you decide. Save a path to complete the loop.
            </p>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            {!report.pathSaved && onSaveDecision ? (
              <button
                type="button"
                onClick={onSaveDecision}
                disabled={saveBusy}
                className="rounded-full bg-ink px-4 py-2 text-sm font-medium text-bg transition hover:bg-chronos disabled:opacity-50"
              >
                {saveBusy ? "Saving…" : "Save decision"}
              </button>
            ) : null}
            {onCompare ? (
              <button
                type="button"
                onClick={onCompare}
                className="rounded-full border border-line px-4 py-2 text-sm text-ink hover:border-chronos/50 hover:text-chronos"
              >
                Compare alternatives
              </button>
            ) : null}
            {onRerun ? (
              <button
                type="button"
                onClick={onRerun}
                className="rounded-full border border-line px-4 py-2 text-sm text-ink hover:border-chronos/50 hover:text-chronos"
              >
                Run again
              </button>
            ) : null}
          </div>
        </section>

        {outcomeSlot ? <section className="px-5 py-5 sm:px-6">{outcomeSlot}</section> : null}
      </div>

      <div className="flex flex-wrap gap-2 border-t border-line px-5 py-4 sm:px-6">
        <button
          type="button"
          onClick={() => void copy()}
          className="rounded-full border border-line px-4 py-2 text-sm text-ink hover:text-chronos"
        >
          Copy report
        </button>
        <button
          type="button"
          onClick={download}
          className="rounded-full border border-line px-4 py-2 text-sm text-ink hover:text-chronos"
        >
          Download .md
        </button>
        {href && (
          <Link to={href} className="ml-auto font-mono text-[11px] uppercase text-chronos">
            Open simulation →
          </Link>
        )}
      </div>
    </article>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line px-3 py-3">
      <dt className="font-mono text-[10px] uppercase text-ink-faint">{label}</dt>
      <dd className="mt-1 font-mono text-2xl text-chronos">{value}</dd>
    </div>
  );
}
