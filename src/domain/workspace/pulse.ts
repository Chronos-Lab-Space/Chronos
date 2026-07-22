import { knowledgeCounts } from "./seed";
import { nextMvpGate } from "./mvpGates";
import type { SimulationRecord, WorkspaceHome } from "./types";

/**
 * Workspace Pulse — live state of the decision being worked, not a chat greeting.
 *
 * Philosophy: "What decision are you working on?" not "What do you want to ask AI?"
 */
export type WorkspacePulse = {
  knowledgeCoverage: number; // 0–100
  simulationConfidence: number; // 0–100 (0 if no completed run)
  openTasks: number;
  lastUpdatedAt: string | null; // ISO
  recommendation: string;
  recommendationHref: string;
  decisionTitle: string;
};

/** Targets for "full enough" knowledge coverage (RAG-lite, not infinite). */
const COVERAGE_TARGETS = {
  documents: 5,
  notes: 3,
  urls: 2,
  contentChars: 4000,
} as const;

export function computeWorkspacePulse(home: WorkspaceHome): WorkspacePulse {
  const knowledgeCoverage = computeKnowledgeCoverage(home);
  const latest = home.recentSimulations[0] ?? null;
  const simulationConfidence = computeSimulationConfidence(latest);
  const openTasks = countOpenTasks(home, latest);
  const lastUpdatedAt = findLastUpdatedAt(home);
  const rec = buildRecommendation(home, latest, knowledgeCoverage);

  return {
    knowledgeCoverage,
    simulationConfidence,
    openTasks,
    lastUpdatedAt,
    recommendation: rec.text,
    recommendationHref: rec.href,
    decisionTitle: home.goal?.title?.trim() || home.workspace.name,
  };
}

export function computeKnowledgeCoverage(home: WorkspaceHome): number {
  const counts = knowledgeCounts(home.knowledge);
  const noteCount = Math.max(home.notes.length, counts.notes);
  const contentChars =
    home.knowledge.reduce((n, k) => n + (k.content?.length ?? 0), 0) +
    home.notes.reduce((n, note) => n + (note.content?.length ?? 0), 0);

  const docScore = Math.min(1, counts.documents / COVERAGE_TARGETS.documents);
  const noteScore = Math.min(1, noteCount / COVERAGE_TARGETS.notes);
  const urlScore = Math.min(1, counts.urls / COVERAGE_TARGETS.urls);
  const depthScore = Math.min(1, contentChars / COVERAGE_TARGETS.contentChars);

  // Weighted: diversity of sources + some depth
  const raw = docScore * 0.35 + noteScore * 0.25 + urlScore * 0.2 + depthScore * 0.2;
  return Math.round(raw * 100);
}

function computeSimulationConfidence(latest: SimulationRecord | null): number {
  if (!latest || latest.status !== "completed" || latest.confidence == null) return 0;
  return Math.round(Math.max(0, Math.min(1, latest.confidence)) * 100);
}

/**
 * Open work items Chronos is tracking (not a full task DB).
 * Incomplete gates, unchosen path, thin context, failed/running sims, etc.
 */
export function countOpenTasks(
  home: WorkspaceHome,
  latest: SimulationRecord | null = home.recentSimulations[0] ?? null
): number {
  let open = 0;

  if (!home.goal) open += 1;

  const hasContext = home.knowledge.length > 0 || home.notes.length > 0;
  if (!hasContext) open += 1;

  if (home.recentSimulations.length === 0) open += 1;

  if (latest) {
    if (latest.status === "running" || latest.status === "queued") open += 1;
    if (latest.status === "failed") open += 1;
    if (latest.status === "completed" && !latest.result.chosen_future_id) open += 1;
    if (
      latest.status === "completed" &&
      latest.result.chosen_future_id &&
      !latest.result.outcome_followed
    ) {
      open += 1;
    }

    const tasks = Array.isArray(latest.result.tasks) ? latest.result.tasks : [];
    open += tasks.filter((t) => t.status === "pending" || t.status === "running").length;
  }

  // Versioned memory not started
  if (home.recentSimulations.length === 1) open += 1;

  // Remaining MVP gates that still need a user action
  const next = nextMvpGate(home);
  if (next && !["workspace", "persist", "context", "simulate"].includes(next.id)) {
    open += 1;
  }

  return open;
}

function findLastUpdatedAt(home: WorkspaceHome): string | null {
  const stamps: string[] = [home.workspace.created_at];
  if (home.goal) stamps.push(home.goal.created_at);
  for (const k of home.knowledge) stamps.push(k.created_at);
  for (const n of home.notes) stamps.push(n.created_at);
  for (const s of home.recentSimulations) {
    stamps.push(s.created_at);
    if (typeof s.result.chosen_at === "string") stamps.push(s.result.chosen_at);
    if (typeof s.result.report_saved_at === "string") stamps.push(s.result.report_saved_at);
  }

  let best: string | null = null;
  let bestMs = -Infinity;
  for (const iso of stamps) {
    const ms = Date.parse(iso);
    if (!Number.isNaN(ms) && ms >= bestMs) {
      bestMs = ms;
      best = iso;
    }
  }
  return best;
}

function buildRecommendation(
  home: WorkspaceHome,
  latest: SimulationRecord | null,
  knowledgeCoverage: number
): { text: string; href: string } {
  if (!home.goal) {
    return { text: "Set the decision you are working on.", href: "/workspace" };
  }

  // Blocking gaps first — then active decision work — then quality polish.
  if (home.knowledge.length === 0 && home.notes.length === 0) {
    return {
      text: "Add context so the next simulation has evidence to rank.",
      href: "/workspace/knowledge",
    };
  }

  if (!latest) {
    if (knowledgeCoverage < 40) {
      return {
        text: "Widen knowledge coverage — more docs and notes raise simulation quality.",
        href: "/workspace/knowledge",
      };
    }
    return {
      text: `Run a simulation on “${home.goal.title}”.`,
      href: "/workspace/simulations?new=1",
    };
  }

  if (latest.status === "failed") {
    return {
      text: "Last run failed — re-run with clearer constraints.",
      href: `/workspace/simulations/${latest.id}`,
    };
  }

  if (latest.status === "running" || latest.status === "queued") {
    return {
      text: "A simulation is in progress — open it when tasks complete.",
      href: `/workspace/simulations/${latest.id}`,
    };
  }

  // Decision moment beats "add more knowledge"
  if (latest.status === "completed" && !latest.result.chosen_future_id) {
    const best =
      (typeof latest.result.best_future === "string" && latest.result.best_future) ||
      "the top-ranked future";
    return {
      text: `Compare futures and choose a path (engine suggests “${best}”).`,
      href: `/workspace/simulations/${latest.id}`,
    };
  }

  // Outcome tracking — path saved, follow-through not logged
  if (latest.status === "completed" && latest.result.chosen_future_id) {
    if (!latest.result.outcome_followed) {
      return {
        text: "Did you follow this recommendation? Log Yes / Partially / No.",
        href: `/workspace/simulations/${latest.id}`,
      };
    }
    if (!latest.result.outcome_result) {
      return {
        text: "How did it turn out? Capture the outcome for persistent memory.",
        href: `/workspace/simulations/${latest.id}`,
      };
    }
  }

  if (home.recentSimulations.length < 2) {
    return {
      text: "Re-run with tighter constraints to build versioned memory.",
      href: `/workspace/simulations/${latest.id}`,
    };
  }

  if (typeof latest.result.recommendation === "string" && latest.result.recommendation.trim()) {
    const short = latest.result.recommendation.trim();
    return {
      text: short.length > 120 ? `${short.slice(0, 117)}…` : short,
      href: `/workspace/simulations/${latest.id}`,
    };
  }

  if (knowledgeCoverage < 50) {
    return {
      text: "Widen knowledge coverage — more docs and notes raise simulation quality.",
      href: "/workspace/knowledge",
    };
  }

  const next = nextMvpGate(home);
  if (next) {
    return {
      text: `${next.usableWhen}.`,
      href: next.href,
    };
  }

  return {
    text: "Continue executing the chosen path — log outcomes into knowledge.",
    href: "/workspace/timeline",
  };
}

/** Human relative time for pulse “Last Updated”. */
export function formatRelativeTime(
  iso: string | null,
  nowMs: number = Date.now()
): string {
  if (!iso) return "—";
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return "—";

  const deltaSec = Math.round((nowMs - then) / 1000);
  if (deltaSec < 45) return "just now";
  if (deltaSec < 90) return "1 minute ago";

  const mins = Math.round(deltaSec / 60);
  if (mins < 60) return `${mins} minute${mins === 1 ? "" : "s"} ago`;

  const hours = Math.round(mins / 60);
  if (hours < 48) return `${hours} hour${hours === 1 ? "" : "s"} ago`;

  const days = Math.round(hours / 24);
  if (days < 14) return `${days} day${days === 1 ? "" : "s"} ago`;

  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}
