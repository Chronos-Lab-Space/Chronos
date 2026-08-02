/**
 * Knowledge-diff "replay" — not re-running the engine on the same inputs
 * (that is byte-identical by design), but answering: what did the library
 * gain or lose since this simulation, so a re-run would see different
 * grounding?
 *
 * See SPEC-calibration.md "On Replay".
 */

import { resolveKnowledgeUsed, type KnowledgeUsedRef } from "./simulationReport";
import type { SimulationRecord, WorkspaceHome } from "./types";

export type KnowledgeDeltaItem = {
  id: string;
  type: string;
  title: string;
};

export type KnowledgeDelta = {
  /** Snapshot stored on the run (or fall back to resolveKnowledgeUsed). */
  atRun: readonly KnowledgeDeltaItem[];
  /** Current library (knowledge + notes). */
  now: readonly KnowledgeDeltaItem[];
  added: readonly KnowledgeDeltaItem[];
  removed: readonly KnowledgeDeltaItem[];
  unchanged: number;
  /** True when a re-run would see a different library than this run stored. */
  hasChanges: boolean;
};

function keyOf(item: { id: string }): string {
  return item.id;
}

function currentLibrary(home: WorkspaceHome): KnowledgeDeltaItem[] {
  const fromKnowledge = home.knowledge.map((k) => ({
    id: k.id,
    type: k.type,
    title: k.title,
  }));
  const fromNotes = home.notes
    .filter((n) => !home.knowledge.some((k) => k.metadata?.note_id === n.id))
    .map((n) => ({
      id: n.id,
      type: "note",
      title: n.title,
    }));
  return [...fromKnowledge, ...fromNotes];
}

/**
 * Diff the library that grounded a past run against today's library.
 * Pure — never touches the engine or scores.
 */
export function deriveKnowledgeDelta(
  home: WorkspaceHome,
  simulation: SimulationRecord
): KnowledgeDelta {
  const atRun: KnowledgeDeltaItem[] = resolveKnowledgeUsed(simulation, home).map((k) => ({
    id: k.id,
    type: k.type,
    title: k.title,
  }));
  const now = currentLibrary(home);

  const runIds = new Set(atRun.map(keyOf));
  const nowIds = new Set(now.map(keyOf));

  const added = now.filter((item) => !runIds.has(keyOf(item)));
  const removed = atRun.filter((item) => !nowIds.has(keyOf(item)));
  const unchanged = atRun.filter((item) => nowIds.has(keyOf(item))).length;

  return {
    atRun,
    now,
    added,
    removed,
    unchanged,
    hasChanges: added.length > 0 || removed.length > 0,
  };
}

/** Thin re-export for callers that only need the snapshot type. */
export type { KnowledgeUsedRef };
