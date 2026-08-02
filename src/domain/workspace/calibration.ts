import type { OutcomeVerdict, SimulationRecord, WorkspaceHome } from "./types";

/**
 * Calibration — reading back what the product's confidence has been worth.
 *
 * Every collapsed run stores the confidence Chronos predicted; every logged
 * outcome stores the user's verdict on how it landed. Until now the two had
 * never been compared, so the confidence number was decoration.
 *
 * This is a *report on* confidence, never an input to it. Nothing here reaches
 * the engine: ranking, scoring and confidence stay engine-owned.
 *
 * The measurement is agreement between Chronos and the user's recollection,
 * not ground truth — `outcome_verdict` is self-reported. Copy built on this
 * must not imply objective accuracy. See SPEC-calibration.md.
 */

/**
 * Minimum followed, verdicted runs before a band reports a rate at all.
 *
 * A rate over two runs is noise, and printing it would be another number that
 * looks like information and is not. At five, one flip moves the band 20pp —
 * visibly coarse, which is the honest impression to leave.
 */
export const CALIBRATION_MIN_SAMPLE = 5;

/** Confidence bands, high to low. `min` is inclusive, `max` exclusive. */
export const CALIBRATION_BANDS = [
  { label: "85–100%", min: 0.85, max: Number.POSITIVE_INFINITY },
  { label: "70–84%", min: 0.7, max: 0.85 },
  { label: "50–69%", min: 0.5, max: 0.7 },
  { label: "below 50%", min: Number.NEGATIVE_INFINITY, max: 0.5 },
] as const;

export type CalibrationBand = {
  label: string;
  /** Followed runs with a verdict that fell in this band. Always shown. */
  n: number;
  /** How many of those landed as predicted or better. */
  landed: number;
  /** Landed / n, or null when the band is below the minimum sample size. */
  rate: number | null;
  hasEnoughData: boolean;
};

export type CalibrationVersionPoint = {
  simulationId: string;
  version: number;
  verdict: OutcomeVerdict;
};

/**
 * Whether a decision's later prediction landed closer than its earlier one.
 * Distinct from the band hit-rate on purpose: this asks how *close* the
 * prediction was, so overshooting counts as divergence, not as a hit.
 */
export type CalibrationMovement = {
  decisionId: string;
  from: CalibrationVersionPoint;
  to: CalibrationVersionPoint;
  direction: "closer" | "further" | "unchanged";
};

export type Calibration = {
  bands: readonly CalibrationBand[];
  /** Followed runs carrying a verdict — the denominator behind every band. */
  totalMeasured: number;
  /** Runs the user did not follow. Excluded, never counted as misses. */
  excludedNotFollowed: number;
  /** Collapsed runs with no verdict logged. Silence is not "as expected". */
  unverifiedCount: number;
  /** Measured runs the user only partially followed. */
  partialCount: number;
  movement: readonly CalibrationMovement[];
  hasData: boolean;
};

/** Distance from the prediction. `as_expected` is the only bullseye. */
function distanceFromPrediction(verdict: OutcomeVerdict): number {
  return verdict === "as_expected" ? 0 : 1;
}

/** The band table's question: did it land as predicted, or better? */
function landedAsPredictedOrBetter(verdict: OutcomeVerdict): boolean {
  return verdict === "as_expected" || verdict === "better";
}

function isVerdict(value: unknown): value is OutcomeVerdict {
  return value === "better" || value === "as_expected" || value === "worse";
}

function bandFor(confidence: number): (typeof CALIBRATION_BANDS)[number] {
  // Bands span the whole line, so this always matches; the fallback keeps the
  // return type non-optional rather than guarding a case that cannot happen.
  return (
    CALIBRATION_BANDS.find((b) => confidence >= b.min && confidence < b.max) ??
    CALIBRATION_BANDS[CALIBRATION_BANDS.length - 1]
  );
}

/** A run that can test a prediction: collapsed, followed, and verdicted. */
type MeasurableRun = {
  simulation: SimulationRecord;
  confidence: number;
  verdict: OutcomeVerdict;
};

function decisionIdOf(sim: SimulationRecord): string {
  return sim.decision_id ?? sim.lineage_id;
}

export function deriveCalibration(home: WorkspaceHome | null | undefined): Calibration {
  const counts = CALIBRATION_BANDS.map(() => ({ n: 0, landed: 0 }));
  const measurable: MeasurableRun[] = [];
  let excludedNotFollowed = 0;
  let unverifiedCount = 0;
  let partialCount = 0;

  for (const sim of home?.recentSimulations ?? []) {
    // Confidence is only meaningful once a run has collapsed.
    if (sim.status !== "completed" || typeof sim.confidence !== "number") continue;

    const followed = sim.result.outcome_followed ?? null;
    const verdict = sim.result.outcome_verdict;

    // Absence of evidence, not evidence of error: the user measured a
    // different world, so this run cannot test the prediction either way.
    if (followed === "no") {
      excludedNotFollowed += 1;
      continue;
    }

    if (!isVerdict(verdict)) {
      unverifiedCount += 1;
      continue;
    }

    if (followed !== "yes" && followed !== "partially") {
      // A verdict without an adoption answer says nothing about whether the
      // recommendation was tried. Treated the same as no verdict at all.
      unverifiedCount += 1;
      continue;
    }

    if (followed === "partially") partialCount += 1;

    const index = CALIBRATION_BANDS.indexOf(bandFor(sim.confidence));
    counts[index].n += 1;
    if (landedAsPredictedOrBetter(verdict)) counts[index].landed += 1;
    measurable.push({ simulation: sim, confidence: sim.confidence, verdict });
  }

  const bands: CalibrationBand[] = CALIBRATION_BANDS.map((definition, index) => {
    const { n, landed } = counts[index];
    const hasEnoughData = n >= CALIBRATION_MIN_SAMPLE;
    return {
      label: definition.label,
      n,
      landed,
      // Withheld below the threshold — no rate at all, rather than a precise
      // number derived from noise.
      rate: hasEnoughData ? landed / n : null,
      hasEnoughData,
    };
  });

  return {
    bands,
    totalMeasured: measurable.length,
    excludedNotFollowed,
    unverifiedCount,
    partialCount,
    movement: deriveMovement(measurable),
    hasData: measurable.length > 0,
  };
}

/**
 * Per-decision movement: for decisions re-run and followed more than once,
 * did the latest prediction land closer than the first?
 *
 * Expected to be extremely sparse for a long time — an empty list is the
 * normal result, not a failure.
 */
function deriveMovement(measurable: readonly MeasurableRun[]): CalibrationMovement[] {
  const byDecision = new Map<string, MeasurableRun[]>();
  for (const run of measurable) {
    const id = decisionIdOf(run.simulation);
    const bucket = byDecision.get(id);
    if (bucket) bucket.push(run);
    else byDecision.set(id, [run]);
  }

  const movement: CalibrationMovement[] = [];
  for (const [decisionId, runs] of byDecision) {
    if (runs.length < 2) continue;

    const ordered = [...runs].sort(
      (a, b) =>
        a.simulation.version - b.simulation.version ||
        a.simulation.created_at.localeCompare(b.simulation.created_at)
    );
    const first = ordered[0];
    const last = ordered[ordered.length - 1];
    const delta = distanceFromPrediction(last.verdict) - distanceFromPrediction(first.verdict);

    movement.push({
      decisionId,
      from: point(first),
      to: point(last),
      direction: delta < 0 ? "closer" : delta > 0 ? "further" : "unchanged",
    });
  }
  return movement;
}

function point(run: MeasurableRun): CalibrationVersionPoint {
  return {
    simulationId: run.simulation.id,
    version: run.simulation.version,
    verdict: run.verdict,
  };
}

/**
 * Slice 3 — caveat a displayed confidence with measured band history.
 *
 * Returns null when the band lacks enough followed, verdicted runs. Never
 * invents a rate from noise, and never rewrites the engine's number: the
 * caller shows both side by side. See SPEC-calibration.md slice 3.
 */
export type ConfidenceCaveat = {
  /** Band label the claimed confidence falls in (e.g. "70–84%"). */
  bandLabel: string;
  /** Historical landed-as-predicted-or-better rate for that band. */
  rate: number;
  n: number;
  landed: number;
};

export function caveatForConfidence(
  calibration: Calibration,
  confidence: number
): ConfidenceCaveat | null {
  if (!Number.isFinite(confidence)) return null;
  const definition = bandFor(confidence);
  const band = calibration.bands.find((b) => b.label === definition.label);
  if (!band || !band.hasEnoughData || band.rate == null) return null;
  return {
    bandLabel: band.label,
    rate: band.rate,
    n: band.n,
    landed: band.landed,
  };
}

/** One-line copy for UI. Self-reported, not ground truth. */
export function formatConfidenceCaveat(caveat: ConfidenceCaveat): string {
  const pct = Math.round(caveat.rate * 100);
  return `In the ${caveat.bandLabel} band, followed runs landed as predicted or better ${pct}% of the time (${caveat.n} measured). Self-reported.`;
}
