/**
 * Brand loading state — uses public/chronos_loading.png with light motion.
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
