/**
 * Raised when a write loses a race against another tab/device that already
 * persisted a newer version of the same workspace. Blocks the stale write
 * instead of silently overwriting the newer one.
 */
export class WorkspaceConflictError extends Error {
  readonly workspaceId: string;

  constructor(workspaceId: string) {
    super("This workspace was updated in another tab. Reload to see the latest changes.");
    this.name = "WorkspaceConflictError";
    this.workspaceId = workspaceId;
  }
}
