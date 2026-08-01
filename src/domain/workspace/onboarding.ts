import type { WorkspaceHome } from "./types";

/**
 * Onboarded = there is a workspace and a decision. Context is not a gate:
 * a source is worth attaching once you have seen a recommendation, so
 * requiring one first put forms between a visitor and their first result.
 */
export function isWorkspaceOnboarded(home: WorkspaceHome | null): boolean {
  if (!home?.workspace?.id) return false;
  return Boolean(home.goal?.title?.trim());
}

/**
 * Does the shell still owe the visitor the entry screen?
 *
 * `isWorkspaceOnboarded` flips the instant the goal is saved, which on the
 * entry screen happens *before* the first run finishes. Swapping there
 * unmounted the screen mid-submit: its "Simulating…" state and its error
 * branch went with it, and the workspace index offered to "run your first
 * simulation" for a run already in flight. The submit owns the surface until
 * it settles.
 */
export function showsEntrySurface(home: WorkspaceHome | null, entrySubmitting: boolean): boolean {
  return entrySubmitting || !isWorkspaceOnboarded(home);
}
