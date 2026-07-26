/**
 * Deterministic evaluation + ranking of product futures.
 * Used by EvaluationAgent — no I/O, no LLM.
 */

export type EvaluableFuture = {
  id: string;
  name: string;
  score: number;
  risk?: number;
  confidence?: number;
  summary?: string;
};

export type RankedFuture = EvaluableFuture & {
  rank: number;
  expectedValue: number;
  risk: number;
  confidence: number;
  rationale: string;
  policyCompliant: boolean;
};

export type FutureEvaluationResult = {
  ranked: RankedFuture[];
  best: RankedFuture | null;
  /** Separation between best EV and mean of alternatives. */
  edge: number;
  aggregateConfidence: number;
  policyCompliant: boolean;
  rationale: string;
};

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

/** EV proxy: score × (1 − risk) × confidence (defaults: risk 0.5, confidence 0.5). */
export function expectedValueOf(future: EvaluableFuture): number {
  const score = clamp01(future.score);
  const risk = clamp01(future.risk ?? 0.5);
  const confidence = clamp01(future.confidence ?? 0.5);
  return Math.round(score * (1 - risk) * confidence * 1000) / 1000;
}

function rationaleFor(future: EvaluableFuture, ev: number, rank: number): string {
  const risk = clamp01(future.risk ?? 0.5);
  const confidence = clamp01(future.confidence ?? 0.5);
  const bits = [
    `EV ${ev.toFixed(3)}`,
    `score ${clamp01(future.score).toFixed(2)}`,
    `risk ${risk.toFixed(2)}`,
    `confidence ${confidence.toFixed(2)}`,
  ];
  if (rank === 1) bits.push("top-ranked");
  if (risk >= 0.65) bits.push("elevated risk");
  if (confidence < 0.4) bits.push("low confidence");
  return bits.join(" · ");
}

/**
 * Rank futures by expected value (desc), then lower risk, then name.
 * Soft policy: risk ≥ 0.85 is flagged non-compliant but still ranked.
 */
export function evaluateFutures(
  futures: readonly EvaluableFuture[],
  options: { hardRiskCeiling?: number } = {}
): FutureEvaluationResult {
  const ceiling = options.hardRiskCeiling ?? 0.85;

  const prepared = futures.map((future) => {
    const risk = clamp01(future.risk ?? 0.5);
    const confidence = clamp01(future.confidence ?? 0.5);
    const expectedValue = expectedValueOf({ ...future, risk, confidence });
    const policyCompliant = risk < ceiling;
    return {
      ...future,
      risk,
      confidence,
      expectedValue,
      policyCompliant,
      rationale: "",
      rank: 0,
    } satisfies RankedFuture;
  });

  prepared.sort(
    (a, b) => b.expectedValue - a.expectedValue || a.risk - b.risk || a.name.localeCompare(b.name)
  );

  const ranked = prepared.map((future, index) => ({
    ...future,
    rank: index + 1,
    rationale: rationaleFor(future, future.expectedValue, index + 1),
  }));

  const best = ranked[0] ?? null;
  const alternatives = ranked.slice(1);
  const meanAlt =
    alternatives.length > 0
      ? alternatives.reduce((sum, f) => sum + f.expectedValue, 0) / alternatives.length
      : 0;
  const edge = best ? Math.round((best.expectedValue - meanAlt) * 1000) / 1000 : 0;

  const aggregateConfidence =
    ranked.length === 0
      ? 0
      : Math.round((ranked.reduce((sum, f) => sum + f.confidence, 0) / ranked.length) * 1000) /
        1000;

  const policyCompliant = ranked.every((f) => f.policyCompliant) || ranked.length === 0;

  const rationale = best
    ? `Selected "${best.name}" (rank 1, EV ${best.expectedValue.toFixed(3)}, edge ${edge.toFixed(3)}).`
    : "No futures to evaluate.";

  return {
    ranked,
    best,
    edge,
    aggregateConfidence,
    policyCompliant,
    rationale,
  };
}
