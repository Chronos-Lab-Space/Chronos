/**
 * Brand loading art (chronos_loading.webp).
 * Use fullScreen only for sign-in → workspace entry (AuthCallback).
 * Elsewhere prefer compact / inline loading.
 */
export function WorkspaceLoadingScreen({
  message = "Opening decision workspace",
  fullScreen = false,
}: {
  message?: string;
  /** Full viewport — only for auth / workspace entry. */
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
          src="/chronos_loading.webp"
          alt=""
          className="workspace-loading-art"
          width={1536}
          height={1024}
          decoding="async"
          fetchPriority={fullScreen ? "high" : "auto"}
        />
        <div className="workspace-loading-art-shine" />
      </div>

      <div className="workspace-loading-footer">
        <p className="workspace-loading-sub">{message}</p>
        {fullScreen ? (
          <div className="workspace-loading-phases" aria-hidden>
            <span>Branch</span>
            <span className="workspace-loading-phase-dot" />
            <span>Simulate</span>
            <span className="workspace-loading-phase-dot" />
            <span>Evaluate</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** Lightweight non-brand spinner for route suspense / generic waits. */
export function QuietLoading({ message = "Loading…" }: { message?: string }) {
  return (
    <div
      className="flex min-h-[40vh] flex-col items-center justify-center gap-3 px-4 py-10"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div
        className="h-6 w-6 rounded-full border-2 border-chronos/30 border-t-chronos animate-spin"
        aria-hidden
      />
      <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-faint">
        {message}
      </div>
    </div>
  );
}
