/**
 * Anonymous workspace identity.
 *
 * An owner *key*, not a user: it exists so LocalWorkspaceStore has something to
 * hang a bundle off before anyone signs in. It is never sent to Supabase, never
 * written to `profiles`, and never appears in an RLS predicate — anonymous mode
 * constructs WorkspaceService with `remote: null`, so there is no code path that
 * could send it anywhere.
 *
 * The `anon-` prefix is what makes that decision checkable: isAnonymousOwnerId
 * is the single place the app asks "may this owner write to the cloud?".
 *
 * See SPEC-anonymous-workspace.md.
 */

export const ANON_OWNER_KEY = "chronos.anon.owner";

const ANON_PREFIX = "anon-";

/** Session-scoped fallback when storage is blocked (private browsing). */
let inMemoryId: string | null = null;

function uuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  // Non-crypto environments only. Identity, not engine state — CLAUDE.md allows
  // unseeded randomness for UUID fallbacks.
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Reads storage, distinguishing "available and empty" from "unavailable".
 * The difference matters: when storage works it is the only source of truth, so
 * clearing site data actually resets the identity instead of the in-memory
 * fallback resurrecting it.
 */
function readStored(): { available: boolean; value: string | null } {
  try {
    return { available: true, value: localStorage.getItem(ANON_OWNER_KEY) };
  } catch {
    return { available: false, value: null };
  }
}

/** Existing anonymous id, without minting one. */
export function peekAnonymousOwnerId(): string | null {
  const stored = readStored();
  return stored.available ? stored.value : inMemoryId;
}

/**
 * Stable anonymous owner id for this browser, creating it on first use.
 * Must be stable — a fresh id per call would orphan the workspace on reload.
 */
export function getOrCreateAnonymousOwnerId(): string {
  const existing = peekAnonymousOwnerId();
  if (existing) return existing;

  const id = `${ANON_PREFIX}${uuid()}`;
  inMemoryId = id;
  try {
    localStorage.setItem(ANON_OWNER_KEY, id);
  } catch {
    // Storage blocked — the id stays session-scoped rather than failing the
    // workspace outright.
  }
  return id;
}

/**
 * Whether this owner is anonymous. The single gate deciding if cloud writes are
 * structurally disabled, so it must never return true for a real user id.
 */
export function isAnonymousOwnerId(ownerId: string | null | undefined): boolean {
  return typeof ownerId === "string" && ownerId.startsWith(ANON_PREFIX);
}

/** Called only after anonymous work has been successfully claimed. */
export function clearAnonymousOwnerId(): void {
  inMemoryId = null;
  try {
    localStorage.removeItem(ANON_OWNER_KEY);
  } catch {
    // Nothing to clear if storage was never available.
  }
}
