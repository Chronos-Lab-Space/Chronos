import type { FutureRecord } from "./types";

/**
 * Future graph layout — Chronos' signature branching visualization.
 * Pure geometry: NOW (root) on the left, one branch node per future ranked
 * best-first top-to-bottom, and a terminal risk node per branch. The
 * component layer only draws; everything here is testable without React.
 */

export type FutureGraphNode = {
  id: string;
  name: string;
  scorePct: number;
  riskPct: number;
  recommended: boolean;
  chosen: boolean;
  x: number;
  y: number;
  /** Terminal outcome node for this branch. */
  tail: { x: number; y: number; label: string };
};

export type FutureGraphLayout = {
  width: number;
  height: number;
  root: { x: number; y: number };
  nodes: FutureGraphNode[];
};

export const GRAPH_WIDTH = 560;
const ROOT_X = 70;
const BRANCH_X = 250;
const TAIL_X = 440;
const TOP_MARGIN = 64;
const ROW_SPACING = 86;

export function layoutFutureGraph(
  futures: readonly FutureRecord[],
  options?: { bestName?: string | null; chosenId?: string | null }
): FutureGraphLayout | null {
  if (futures.length === 0) return null;

  const bestName = options?.bestName?.trim() || null;
  const chosenId = options?.chosenId?.trim() || null;
  const ranked = [...futures].sort((a, b) => b.score - a.score);

  const nodes: FutureGraphNode[] = ranked.map((future, i) => {
    const y = TOP_MARGIN + i * ROW_SPACING;
    const riskPct = Math.round(future.risk * 100);
    return {
      id: future.id,
      name: future.name,
      scorePct: Math.round(future.score * 100),
      riskPct,
      recommended: bestName ? future.name === bestName : i === 0,
      chosen: chosenId === future.id,
      x: BRANCH_X,
      y,
      tail: { x: TAIL_X, y, label: `RISK ${riskPct}%` },
    };
  });

  const firstY = TOP_MARGIN;
  const lastY = TOP_MARGIN + (nodes.length - 1) * ROW_SPACING;

  return {
    width: GRAPH_WIDTH,
    height: lastY + TOP_MARGIN,
    root: { x: ROOT_X, y: Math.round((firstY + lastY) / 2) },
    nodes,
  };
}
