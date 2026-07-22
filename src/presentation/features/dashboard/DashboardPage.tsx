import { ScrollReveal } from "../../components/ScrollReveal";
import { useWorkspace } from "../workspace/WorkspaceContext";
import { DashboardHeader } from "./components/DashboardHeader";
import { KnowledgeSummary } from "./components/KnowledgeSummary";
import { MvpProgress } from "./components/MvpProgress";
import { QuickActions } from "./components/QuickActions";
import { RecentSimulations } from "./components/RecentSimulations";
import { TimelinePreview } from "./components/TimelinePreview";

/**
 * Workspace HQ — progressive MVP path.
 * Each phase stays usable: navigate → persist → context → simulate → see futures → accumulate.
 */
export function DashboardPage() {
  const { home, ownerId } = useWorkspace();
  if (!home?.goal) return null;

  const latest = home.recentSimulations[0] ?? null;

  return (
    <div className="ws-cascade space-y-10">
      <DashboardHeader
        workspace={home.workspace}
        goal={home.goal}
        userLabel={ownerId ? ownerId.slice(0, 8) : "You"}
      />
      <ScrollReveal delay={40} variant="up">
        <MvpProgress home={home} />
      </ScrollReveal>
      <ScrollReveal delay={80} variant="fade">
        <QuickActions />
      </ScrollReveal>
      <ScrollReveal delay={120} variant="up">
        <RecentSimulations simulations={home.recentSimulations} />
      </ScrollReveal>
      <ScrollReveal delay={160} variant="fade">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          <KnowledgeSummary knowledge={home.knowledge} notes={home.notes} />
          <TimelinePreview latest={latest} />
        </div>
      </ScrollReveal>
    </div>
  );
}
