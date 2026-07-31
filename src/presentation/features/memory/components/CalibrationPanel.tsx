import { useMemo } from "react";
import { Link } from "react-router-dom";
import {
  CALIBRATION_BANDS,
  CALIBRATION_MIN_SAMPLE,
  type CalibrationBand,
  type CalibrationMovement,
  deriveCalibration,
} from "../../../../domain/workspace/calibration";
import { confidencePercent } from "../../../../domain/workspace/seed";
import type { OutcomeVerdict, WorkspaceHome } from "../../../../domain/workspace/types";

/**
 * Calibration — what the confidence number has been worth.
 *
 * The plot draws each band as what it literally is: an *interval* Chronos
 * claimed, and a *point* where those runs actually landed. Distance between
 * the two is the miscalibration, readable without encoding hit/miss as hue —
 * which the palette forbids anyway (see the normalization block in index.css).
 *
 * A band with too few runs draws its interval and no point. The missing dot is
 * the "not enough data" signal, so the panel reads as "here are four claims;
 * here is which ones have been checked" rather than a scorecard.
 *
 * Numbers are text; the plot is aria-hidden decoration over them.
 */
export function CalibrationPanel({ home }: { home: WorkspaceHome }) {
  const calibration = useMemo(() => deriveCalibration(home), [home]);
  const titleOf = useMemo(() => {
    const byId = new Map(home.recentSimulations.map((s) => [s.id, s.title]));
    return (id: string) => byId.get(id) ?? "Untitled run";
  }, [home.recentSimulations]);

  const { bands, totalMeasured, excludedNotFollowed, unverifiedCount, partialCount, movement } =
    calibration;

  return (
    <section>
      <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-faint">
        Calibration
      </div>
      <h2 className="mt-2 font-serif text-3xl leading-tight text-ink">
        What confidence has been worth
      </h2>
      <p
        data-testid="calibration-caveat"
        className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-dim"
      >
        Each band is a claim Chronos made. Runs are scored only where you followed the
        recommendation and logged how it landed, so this measures agreement with your own
        recollection — not independent accuracy.
      </p>

      {calibration.hasData ? (
        <>
          <BandPlot bands={bands} />
          <p
            data-testid="calibration-denominators"
            className="mt-4 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint"
          >
            {totalMeasured} measured
            {partialCount > 0 ? ` · ${partialCount} partly followed` : ""} · {excludedNotFollowed}{" "}
            not followed, excluded · {unverifiedCount} awaiting an outcome
          </p>
          <p className="mt-2 max-w-2xl text-xs leading-relaxed text-ink-faint">
            A band reports a rate at {CALIBRATION_MIN_SAMPLE} followed runs with an outcome. Below
            that it reports none — a rate over two runs is noise. Runs you did not follow measured a
            different world, so they are excluded rather than counted as misses.
          </p>
          <Movement movement={movement} titleOf={titleOf} />
        </>
      ) : (
        <Empty excluded={excludedNotFollowed} unverified={unverifiedCount} />
      )}
    </section>
  );
}

/** Display bounds for a band, clamped off the infinities the domain uses. */
function boundsFor(label: string): { lo: number; hi: number } {
  const definition = CALIBRATION_BANDS.find((d) => d.label === label);
  return {
    lo: Math.max(0, definition?.min ?? 0),
    hi: Math.min(1, definition?.max ?? 1),
  };
}

function BandPlot({ bands }: { bands: readonly CalibrationBand[] }) {
  return (
    <div
      data-testid="calibration-bands"
      className="mt-6 rounded-2xl border border-line px-4 py-4 sm:px-5"
    >
      {/* Column heads double as the plot's axis labels. */}
      <div className="grid grid-cols-[1fr_auto_auto] items-baseline gap-x-4 font-mono text-[9px] uppercase tracking-[0.18em] text-ink-faint sm:grid-cols-[7rem_4.5rem_3rem_1fr]">
        <span>Predicted</span>
        <span className="text-right">Landed</span>
        <span className="text-right">Runs</span>
        <span className="hidden justify-between sm:flex" aria-hidden>
          <span>0%</span>
          <span>50%</span>
          <span>100%</span>
        </span>
      </div>

      <ul className="mt-1">
        {bands.map((band) => {
          const { lo, hi } = boundsFor(band.label);
          return (
            <li
              key={band.label}
              data-testid={`calibration-band-${band.label}`}
              className="grid grid-cols-[1fr_auto_auto] items-center gap-x-4 border-t border-line/60 py-3 first:border-t-0 sm:grid-cols-[7rem_4.5rem_3rem_1fr]"
            >
              <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-dim">
                {band.label}
              </span>
              <span
                className={`text-right font-mono text-[13px] tabular-nums ${
                  band.hasEnoughData ? "text-ink" : "text-[10px] uppercase text-ink-faint"
                }`}
              >
                {band.hasEnoughData ? confidencePercent(band.rate) : "Not yet"}
              </span>
              <span className="text-right font-mono text-[11px] tabular-nums text-ink-faint">
                {band.n}
              </span>
              <Track lo={lo} hi={hi} rate={band.hasEnoughData ? band.rate : null} />
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * One band on a shared 0–100% scale: the claimed interval as a bar, the
 * measured rate as a dot. No dot means the claim has not been tested yet.
 *
 * When the dot falls outside the interval, the span between them is drawn —
 * that drawn length *is* the miscalibration. A dot inside its interval gets no
 * connector, so "landed within what it claimed" reads as the absence of a gap.
 */
function Track({ lo, hi, rate }: { lo: number; hi: number; rate: number | null }) {
  const gap =
    rate == null || (rate >= lo && rate <= hi)
      ? null
      : { from: rate < lo ? rate : hi, to: rate < lo ? lo : rate };

  return (
    <div className="relative hidden h-5 sm:block" aria-hidden>
      <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-line" />
      <div className="absolute left-1/2 top-1 bottom-1 w-px bg-line" />
      {gap && (
        <div
          className="absolute top-1/2 h-px -translate-y-1/2"
          style={{
            left: `${gap.from * 100}%`,
            width: `${(gap.to - gap.from) * 100}%`,
            background: "rgba(96, 137, 155, 0.45)",
          }}
        />
      )}
      <div
        className="absolute top-1/2 h-[3px] -translate-y-1/2 rounded-full"
        style={{
          left: `${lo * 100}%`,
          width: `${(hi - lo) * 100}%`,
          background: rate == null ? "rgba(196, 194, 170, 0.2)" : "rgba(196, 194, 170, 0.7)",
        }}
      />
      {rate != null && (
        <div
          className="absolute top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-chronos"
          style={{ left: `${rate * 100}%`, boxShadow: "0 0 0 2px #111111" }}
        />
      )}
    </div>
  );
}

const VERDICT_LABEL: Record<OutcomeVerdict, string> = {
  better: "better than predicted",
  as_expected: "as predicted",
  worse: "worse than predicted",
};

function Movement({
  movement,
  titleOf,
}: {
  movement: readonly CalibrationMovement[];
  titleOf: (id: string) => string;
}) {
  return (
    <div className="mt-8">
      <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-faint">
        Re-run decisions
      </div>
      {movement.length === 0 ? (
        <p className="mt-3 max-w-2xl text-sm text-ink-dim">
          Nothing to compare yet. When you re-run a decision and follow both versions, this shows
          whether the later prediction landed closer than the first.
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {movement.map((m) => (
            <li
              key={m.decisionId}
              className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-t border-line/60 py-3 first:border-t-0"
            >
              <span className="min-w-0 text-sm text-ink">{titleOf(m.to.simulationId)}</span>
              <span className="font-mono text-[11px] text-ink-faint">
                v{m.from.version} {VERDICT_LABEL[m.from.verdict]} → v{m.to.version}{" "}
                {VERDICT_LABEL[m.to.verdict]}
                <span
                  className={`ml-3 uppercase tracking-[0.12em] ${
                    m.direction === "closer" ? "text-chronos" : "text-ink-faint"
                  }`}
                >
                  {m.direction}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Empty({ excluded, unverified }: { excluded: number; unverified: number }) {
  return (
    <div data-testid="calibration-empty" className="mt-6 rounded-2xl border border-line px-5 py-6">
      <p className="max-w-2xl text-sm leading-relaxed text-ink-dim">
        No prediction has been checked yet. Log an outcome on a run you followed and it gets scored
        here — {CALIBRATION_MIN_SAMPLE} runs in a band before that band reports a rate.
      </p>
      {unverified > 0 || excluded > 0 ? (
        <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint">
          {unverified} awaiting an outcome
          {excluded > 0 ? ` · ${excluded} not followed, excluded` : ""}
        </p>
      ) : null}
      <Link
        to="/workspace/simulations"
        className="mt-4 inline-flex rounded-full border border-line px-4 py-2 text-sm text-ink transition hover:border-chronos/50 hover:text-chronos"
      >
        Log an outcome →
      </Link>
    </div>
  );
}
