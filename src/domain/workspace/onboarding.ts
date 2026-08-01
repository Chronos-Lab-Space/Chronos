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
