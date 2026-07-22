import { Component, type ErrorInfo, type ReactNode } from "react";
import { captureException } from "../../infrastructure/monitoring/errorMonitoring";

type Props = {
  children: ReactNode;
  /** Optional fallback UI; default is a Chronos-styled recovery screen */
  fallback?: ReactNode;
};

type State = {
  error: Error | null;
};

/**
 * Catches render errors so the SPA does not white-screen.
 * Reports to error monitoring when configured.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    captureException(error, {
      tags: { boundary: "react" },
      extra: { componentStack: info.componentStack },
      level: "error",
    });
  }

  private reset = () => {
    this.setState({ error: null });
  };

  render() {
    if (!this.state.error) return this.props.children;
    if (this.props.fallback) return this.props.fallback;

    return (
      <div className="flex min-h-dvh items-center justify-center bg-bg px-6">
        <div className="w-full max-w-md rounded-2xl border border-line bg-bg-soft/40 p-6 text-center">
          <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-chronos">
            Something went wrong
          </div>
          <h1 className="mt-3 font-serif text-2xl text-ink">Chronos hit an error</h1>
          <p className="mt-3 text-sm text-ink-dim">
            The failure was logged. You can try again or return home. If it keeps
            happening, contact support with what you were doing.
          </p>
          {import.meta.env.DEV && this.state.error?.message ? (
            <pre className="mt-4 max-h-32 overflow-auto rounded-lg border border-line bg-bg p-3 text-left font-mono text-[11px] text-red-400">
              {this.state.error.message}
            </pre>
          ) : null}
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <button
              type="button"
              onClick={this.reset}
              className="rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-bg hover:bg-chronos"
            >
              Try again
            </button>
            <a
              href="/"
              className="rounded-full border border-line px-5 py-2.5 text-sm text-ink-dim hover:text-chronos"
            >
              Home
            </a>
            <a
              href="/workspace"
              className="rounded-full border border-line px-5 py-2.5 text-sm text-ink-dim hover:text-chronos"
            >
              Workspace
            </a>
          </div>
        </div>
      </div>
    );
  }
}
