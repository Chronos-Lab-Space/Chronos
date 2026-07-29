/**
 * Claim anonymous work when a visitor signs in.
 *
 * LocalWorkspaceStore keys everything under byOwner[ownerId], so claiming is a
 * re-key rather than a merge. Once the bundle sits under the real user id,
 * WorkspaceService.load backfills the empty cloud from local with no new code.
 *
 * The refusal case is the important one. If the account already has decisions,
 * we keep both and merge neither: interleaving two decision histories would
 * corrupt the one thing Chronos promises to remember, and there is no way to
 * undo it afterwards.
 *
 * See SPEC-anonymous-workspace.md.
 */

import { isAnonymousOwnerId } from "../../domain/workspace/anonymousOwner";
import type { LocalWorkspaceStore } from "./LocalWorkspaceStore";

export type ClaimOutcome =
  /** Anonymous work moved to the account. */
  | "claimed"
  /** Account already had decisions; both bundles left intact. */
  | "kept-separate"
  /** No anonymous decisions worth moving. */
  | "nothing-to-claim"
  /** Caller passed something that would lose data. */
  | "refused";

export type ClaimResult = {
  outcome: ClaimOutcome;
  /** Set when work moved, so the UI can name what was kept. */
  workspaceName?: string;
};

/** A bundle counts as "work" only if it holds at least one simulation. */
function hasWork(store: LocalWorkspaceStore, ownerId: string): boolean {
  const home = store.get(ownerId);
  return Boolean(home && home.recentSimulations.length > 0);
}

export function claimAnonymousWork(
  store: LocalWorkspaceStore,
  anonymousOwnerId: string,
  realOwnerId: string
): ClaimResult {
  // Re-keying onto another anonymous identity would strand the work on a
  // throwaway id — most likely a caller passing arguments in the wrong order.
  if (!isAnonymousOwnerId(anonymousOwnerId) || isAnonymousOwnerId(realOwnerId)) {
    return { outcome: "refused" };
  }

  const anonymousHome = store.get(anonymousOwnerId);
  if (!anonymousHome || anonymousHome.recentSimulations.length === 0) {
    // An id minted by merely visiting is not work. Nothing to move, and the
    // account's own data must not be disturbed.
    return { outcome: "nothing-to-claim" };
  }

  if (hasWork(store, realOwnerId)) {
    return { outcome: "kept-separate", workspaceName: anonymousHome.workspace.name };
  }

  store.save(realOwnerId, anonymousHome);
  store.clear(anonymousOwnerId);

  return { outcome: "claimed", workspaceName: anonymousHome.workspace.name };
}
