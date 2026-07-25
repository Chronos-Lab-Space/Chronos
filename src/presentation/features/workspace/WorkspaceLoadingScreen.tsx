/**
 * Motioned enter state while workspace home hydrates.
 * Temporal feel: multi-orbit branches → core pulse on the Chronos palette.
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
      <div className="workspace-loading-field" aria-hidden>
        <span className="workspace-loading-spark workspace-loading-spark-a" />
        <span className="workspace-loading-spark workspace-loading-spark-b" />
        <span className="workspace-loading-spark workspace-loading-spark-c" />
      </div>

      <div className="workspace-loading-orbits" aria-hidden>
        <div className="workspace-loading-ring workspace-loading-ring-outer">
          <span className="workspace-loading-node" />
          <span className="workspace-loading-node workspace-loading-node-b" />
        </div>
        <div className="workspace-loading-ring workspace-loading-ring-mid">
          <span className="workspace-loading-node" />
        </div>
        <div className="workspace-loading-ring workspace-loading-ring-inner">
          <span className="workspace-loading-node" />
          <span className="workspace-loading-node workspace-loading-node-b" />
        </div>
        <div className="workspace-loading-core">
          <span className="workspace-loading-core-glow" />
        </div>
        <div className="workspace-loading-beam" />
      </div>

      <div className="workspace-loading-label">
        <span className="workspace-loading-label-mark">C</span>
        Chronos
      </div>
      <p className="workspace-loading-sub">{message}</p>
      <div className="workspace-loading-phases" aria-hidden>
        <span>Branch</span>
        <span className="workspace-loading-phase-dot" />
        <span>Simulate</span>
        <span className="workspace-loading-phase-dot" />
        <span>Evaluate</span>
      </div>
    </div>
  );
}
