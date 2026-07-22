/**
 * Motioned enter state while workspace home hydrates.
 * Quiet temporal feel: orbits + core pulse on the Chronos palette.
 */
export function WorkspaceLoadingScreen({
  message = "Opening decision workspace",
}: {
  message?: string;
}) {
  return (
    <div
      className="workspace-loading-screen"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="workspace-loading-orbits" aria-hidden>
        <div className="workspace-loading-ring">
          <span className="workspace-loading-node" />
        </div>
        <div className="workspace-loading-ring">
          <span className="workspace-loading-node" />
        </div>
        <div className="workspace-loading-ring">
          <span className="workspace-loading-node" />
        </div>
        <div className="workspace-loading-core" />
      </div>
      <div className="workspace-loading-label">Chronos</div>
      <p className="workspace-loading-sub">{message}</p>
    </div>
  );
}
