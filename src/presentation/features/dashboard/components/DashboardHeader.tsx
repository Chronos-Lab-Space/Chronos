import type { GoalRecord, WorkspaceRecord } from "../../../../domain/workspace/types";

type Props = {
  workspace: WorkspaceRecord;
  goal: GoalRecord | null;
  userLabel?: string;
};

/** Header: workspace name, current goal, user avatar. */
export function DashboardHeader({ workspace, goal, userLabel = "You" }: Props) {
  const initials = userLabel
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <header className="flex flex-wrap items-start justify-between gap-4 border-b border-line pb-8">
      <div className="min-w-0">
        <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-faint">
          Workspace
        </div>
        <h1 className="mt-2 truncate font-serif text-3xl text-ink sm:text-4xl">{workspace.name}</h1>
        {workspace.description ? (
          <p className="mt-2 max-w-xl text-sm text-ink-dim">{workspace.description}</p>
        ) : null}
        <div className="mt-5">
          <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-faint">
            Current goal
          </div>
          <p className="mt-1 text-lg text-ink">{goal?.title ?? "No active goal"}</p>
        </div>
      </div>
      <div
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-line bg-bg-soft/50 font-mono text-[11px] text-chronos"
        title={userLabel}
        role="img"
        aria-label={`Signed in as ${userLabel}`}
      >
        {initials || "CL"}
      </div>
    </header>
  );
}
