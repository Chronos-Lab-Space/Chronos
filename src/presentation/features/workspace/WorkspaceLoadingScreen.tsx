/**
 * Brand loading — full-viewport chronos_loading.png with light motion.
 */
export function WorkspaceLoadingScreen({
  message = "Opening decision workspace",
  fullScreen = true,
}: {
  message?: string;
  /** Cover the entire viewport (default). */
  fullScreen?: boolean;
}) {
  return (
    <div
      className={
        fullScreen
          ? "workspace-loading-screen workspace-loading-screen--full"
          : "workspace-loading-screen"
      }
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="workspace-loading-art-wrap" aria-hidden>
        <img
          src="/chronos_loading.png"
          alt=""
          className="workspace-loading-art"
          width={1536}
          height={1024}
          decoding="async"
          fetchPriority="high"
        />
        <div className="workspace-loading-art-shine" />
      </div>

      <div className="workspace-loading-footer">
        <p className="workspace-loading-sub">{message}</p>
        <div className="workspace-loading-phases" aria-hidden>
          <span>Branch</span>
          <span className="workspace-loading-phase-dot" />
          <span>Simulate</span>
          <span className="workspace-loading-phase-dot" />
          <span>Evaluate</span>
        </div>
      </div>
    </div>
  );
}
