import { useMemo } from "react";
import { evaluateBetaChecklist } from "../../../domain/workspace/betaChecklist";
import { buildDecisionReport } from "../../../domain/workspace/decisionReport";
import {
  buildActivityFeed,
  listPendingDecisions,
} from "../../../domain/workspace/workspaceMemory";
import { useWorkspace } from "../workspace/WorkspaceContext";
import { DecisionReportCard } from "../simulation/components/DecisionReportCard";
import { ActivityFeed } from "./components/ActivityFeed";
import { BetaChecklist } from "./components/BetaChecklist";
import { GoalCard } from "./components/GoalCard";
import { KnowledgeSummary } from "./components/KnowledgeSummary";
import { MvpProgress } from "./components/MvpProgress";
import { PendingDecisions } from "./components/PendingDecisions";
import { RecentSimulations } from "./components/RecentSimulations";
import { TimelinePreview } from "./components/TimelinePreview";
import { WorkspacePulse } from "./components/WorkspacePulse";

/**
 * Decision Workspace HQ.
 * Answers: What am I working on? Pending decisions? Sims run? What changed?
 */
export function DashboardPage() {
  const { home, preferences } = useWorkspace();
  if (!home?.goal) return null;

  const latest = home.recentSimulations[0] ?? null;
  const futures = latest ? (home.futuresBySimulation[latest.id] ?? []) : [];
  const goalConfidence = latest?.status === "completed" ? latest.confidence : null;

  const decisionReport = useMemo(() => {
    if (!latest || latest.status !== "completed") return null;
    return buildDecisionReport(home, latest, futures);
  }, [home, latest, futures]);

  const pending = useMemo(() => listPendingDecisions(home), [home]);
  const activity = useMemo(() => buildActivityFeed(home, 8), [home]);
  const checklist = useMemo(
    () => evaluateBetaChecklist(home, preferences),
    [home, preferences]
  );

  return (
    <div className="mx-auto max-w-3xl space-y-5 lg:max-w-none">
      <header className="border-b border-line pb-5">
        <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-faint">
          Decision workspace
        </div>
        <p className="mt-2 text-sm text-ink-dim">
          <span className="text-ink">{home.workspace.name}</span>
          <span className="mx-2 text-ink-faint">·</span>
          Working on, pending decisions, simulations, and what changed — at a glance.
        </p>
      </header>

      <WorkspacePulse home={home} />
      <BetaChecklist items={checklist} />

      {/* 1 · What am I working on? */}
      <GoalCard goal={home.goal} confidence={goalConfidence} />

      {decisionReport && latest && (
        <DecisionReportCard
          report={decisionReport}
          compact
          href={`/workspace/simulations/${latest.id}`}
        />
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* 2 · What decisions are pending? */}
        <PendingDecisions pending={pending} />
        {/* 4 · What changed since last time? */}
        <ActivityFeed items={activity} />
      </div>

      {/* 3 · What simulations have I run? */}
      <RecentSimulations simulations={home.recentSimulations} />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <KnowledgeSummary knowledge={home.knowledge} notes={home.notes} />
        <TimelinePreview latest={latest} futures={futures} />
      </div>

      <MvpProgress home={home} />
    </div>
  );
}
