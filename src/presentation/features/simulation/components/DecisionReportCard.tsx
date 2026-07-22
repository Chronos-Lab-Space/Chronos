import { Link } from "react-router-dom";
import {
  exportDecisionReportMarkdown,
  type DecisionReport,
} from "../../../../domain/workspace/decisionReport";
import { confidencePercent } from "../../../../domain/workspace/seed";
import { trackProductEvent } from "../../../../infrastructure/analytics/productAnalytics";

type Props = {
  report: DecisionReport;
  compact?: boolean;
  href?: string;
  /** Optional outcome-tracking block rendered after next actions */
  outcomeSlot?: React.ReactNode;
};

/**
 * Screenshot-ready Decision Report — the artifact users remember and share.
 * Objective · Context · Alternatives · Trade-offs · Confidence · Path · Risks · Actions
 */
export function DecisionReportCard({ report, compact, href, outcomeSlot }: Props) {
  const conf = confidencePercent(report.confidence);
  const because =
    report.recommendedBecause?.length > 0
      ? report.recommendedBecause
      : report.why.slice(0, 4);

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

  return (
    <article className="overflow-hidden rounded-2xl border border-chronos/40 bg-bg">
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
        {/* Recommended path + confidence + transparent why */}
        <section className="px-5 py-6 sm:px-6">
          <div className="font-mono text-[10px] uppercase text-ink-faint">Recommended path</div>
          <h2 className={`mt-3 font-serif text-ink ${compact ? "text-2xl" : "text-3xl sm:text-4xl"}`}>
            {report.recommended}
          </h2>
          {!compact && report.recommendedSummary ? (
            <p className="mt-3 max-w-2xl text-sm text-ink-dim">{report.recommendedSummary}</p>
          ) : null}
          <div className="mt-5">
            <div className="font-mono text-[10px] uppercase text-ink-faint">Confidence score</div>
            <div className="mt-1 font-mono text-4xl text-chronos sm:text-5xl">{conf}</div>
          </div>

          {/* Trust block — every recommendation explains why */}
          <div className="mt-6 rounded-xl border border-chronos/30 bg-chronos/5 px-4 py-4">
            <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-chronos">
              Recommended because
            </div>
            <ul className="mt-3 space-y-2">
              {because.map((r) => (
                <li key={r} className="flex gap-2.5 text-[15px] text-ink">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-chronos" />
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Objective */}
        <section className="px-5 py-5 sm:px-6">
          <div className="font-mono text-[10px] uppercase text-ink-faint">Objective</div>
          <p className="mt-3 text-[15px] text-ink">{report.objective}</p>
          {report.objectiveDescription ? (
            <p className="mt-2 text-sm text-ink-dim">{report.objectiveDescription}</p>
          ) : null}
        </section>

        {/* Context used */}
        {!compact && (
          <section className="px-5 py-5 sm:px-6">
            <div className="font-mono text-[10px] uppercase text-ink-faint">Context used</div>
            {report.contextUsed.length === 0 ? (
              <p className="mt-3 text-sm text-ink-dim">No knowledge sources recorded for this run.</p>
            ) : (
              <ul className="mt-4 flex flex-wrap gap-2">
                {report.contextUsed.map((c) => (
                  <li
                    key={c.id}
                    className="rounded-full border border-line px-3 py-1.5 text-sm text-ink"
                  >
                    <span className="font-mono text-[10px] uppercase text-ink-faint">{c.type}</span>{" "}
                    {c.title}
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {/* Alternative futures */}
        {!compact && report.alternatives.length > 0 && (
          <section className="px-5 py-5 sm:px-6">
            <div className="font-mono text-[10px] uppercase text-ink-faint">Alternative futures</div>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {report.alternatives.map((a) => (
                <li
                  key={a.id}
                  className={`rounded-xl border px-4 py-3 ${
                    a.isRecommended ? "border-chronos/40 bg-chronos/5" : "border-line"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[10px] uppercase text-ink-faint">
                      Future {a.label}
                      {a.isRecommended ? " · pick" : ""}
                    </span>
                    {a.hook && (
                      <span className="font-mono text-[10px] uppercase text-chronos">{a.hook}</span>
                    )}
                  </div>
                  <div className="mt-1 text-[15px] text-ink">{a.name}</div>
                  <div className="mt-2 font-mono text-sm text-chronos">
                    {Math.round(a.confidence * 100)}%
                    <span className="ml-2 text-ink-faint">
                      risk {Math.round(a.risk * 100)}%
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Trade-offs */}
        {!compact && report.tradeoffs.length > 0 && (
          <section className="px-5 py-5 sm:px-6">
            <div className="font-mono text-[10px] uppercase text-ink-faint">Trade-offs</div>
            <ul className="mt-4 space-y-2">
              {report.tradeoffs.map((t) => (
                <li key={t.futureId} className="flex flex-col gap-0.5 sm:flex-row sm:gap-3">
                  <span className="shrink-0 text-[15px] text-ink">{t.name}</span>
                  <span className="text-sm text-ink-dim">{t.vsBest}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Evidence detail (complements Recommended because) */}
        {!compact && report.why.length > 0 && (
          <section className="px-5 py-5 sm:px-6">
            <div className="font-mono text-[10px] uppercase text-ink-faint">
              Supporting evidence
            </div>
            <ul className="mt-4 grid gap-2 sm:grid-cols-2">
              {report.why.map((w) => (
                <li key={w} className="rounded-xl border border-line px-4 py-3 text-[15px] text-ink">
                  {w}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Risks */}
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

        {/* Next actions */}
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

        {outcomeSlot ? (
          <section className="px-5 py-5 sm:px-6">{outcomeSlot}</section>
        ) : null}

        {/* Compact context strip for dashboard */}
        {compact && report.contextUsed.length > 0 && (
          <section className="px-5 py-4 sm:px-6">
            <div className="font-mono text-[10px] uppercase text-ink-faint">
              Context · {report.contextUsed.length} source
              {report.contextUsed.length === 1 ? "" : "s"}
            </div>
            <p className="mt-2 text-sm text-ink-dim">
              {report.contextUsed
                .slice(0, 4)
                .map((c) => c.title)
                .join(" · ")}
              {report.contextUsed.length > 4 ? " · …" : ""}
            </p>
          </section>
        )}
      </div>

      <div className="flex flex-wrap gap-2 border-t border-line px-5 py-4 sm:px-6">
        <button
          type="button"
          onClick={() => void copy()}
          className="rounded-full border border-line px-4 py-2 text-sm text-ink hover:text-chronos"
        >
          Copy report
        </button>
        {!compact && (
          <button
            type="button"
            onClick={download}
            className="rounded-full border border-line px-4 py-2 text-sm text-ink hover:text-chronos"
          >
            Download .md
          </button>
        )}
        {href && (
          <Link to={href} className="ml-auto font-mono text-[11px] uppercase text-chronos">
            Full simulation →
          </Link>
        )}
      </div>
    </article>
  );
}
