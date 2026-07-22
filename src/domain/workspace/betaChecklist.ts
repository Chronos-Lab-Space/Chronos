/**
 * Public beta onboarding checklist — unlock progress naturally (not a tutorial).
 *
 * Connect LLM (optional) → Create first decision → Run first simulation
 * → Save memory → Share workspace
 */
import type { WorkspaceHome } from "./types";

export type BetaChecklistId =
  | "llm"
  | "decision"
  | "simulation"
  | "memory"
  | "share";

export type BetaChecklistItem = {
  id: BetaChecklistId;
  label: string;
  detail: string;
  optional: boolean;
  done: boolean;
  href: string;
  cta: string;
};

export type UserPreferences = {
  llmProviderConnected: boolean;
  shareAcknowledged: boolean;
  preferredAuthProvider: string | null;
};

export const DEFAULT_PREFERENCES: UserPreferences = {
  llmProviderConnected: false,
  shareAcknowledged: false,
  preferredAuthProvider: null,
};

export function evaluateBetaChecklist(
  home: WorkspaceHome | null,
  prefs: UserPreferences = DEFAULT_PREFERENCES
): BetaChecklistItem[] {
  const hasDecision = Boolean(home?.goal?.title?.trim());
  const hasSimulation = Boolean(home && home.recentSimulations.length > 0);
  const hasSavedMemory = Boolean(
    home?.recentSimulations.some(
      (s) =>
        Boolean(s.result.chosen_future_id) ||
        Boolean(s.result.outcome_followed) ||
        Boolean(s.result.outcome_result)
    )
  );

  return [
    {
      id: "llm",
      label: "Connect LLM provider",
      detail: "Optional — Grok advisor for briefs grounded in your workspace.",
      optional: true,
      done: prefs.llmProviderConnected,
      href: "/workspace/advisor",
      cta: prefs.llmProviderConnected ? "Advisor" : "Connect",
    },
    {
      id: "decision",
      label: "Create first decision",
      detail: "What are you trying to decide?",
      optional: false,
      done: hasDecision,
      href: "/workspace",
      cta: hasDecision ? "Open" : "Set decision",
    },
    {
      id: "simulation",
      label: "Run first simulation",
      detail: "Generate futures and compare trade-offs.",
      optional: false,
      done: hasSimulation,
      href: "/workspace/simulations?new=1",
      cta: hasSimulation ? "Simulations" : "Generate futures",
    },
    {
      id: "memory",
      label: "Save memory",
      detail: "Choose a path or log an outcome so Chronos remembers.",
      optional: false,
      done: hasSavedMemory,
      href: hasSimulation
        ? `/workspace/simulations/${home!.recentSimulations[0].id}`
        : "/workspace/simulations?new=1",
      cta: hasSavedMemory ? "Memory" : "Save path",
    },
    {
      id: "share",
      label: "Share workspace",
      detail: "Invite a teammate or copy a share link (beta).",
      optional: false,
      done: prefs.shareAcknowledged,
      href: "/workspace/settings",
      cta: prefs.shareAcknowledged ? "Settings" : "Share",
    },
  ];
}

export function betaChecklistProgress(items: readonly BetaChecklistItem[]): {
  done: number;
  total: number;
  requiredDone: number;
  requiredTotal: number;
  percent: number;
} {
  const required = items.filter((i) => !i.optional);
  const done = items.filter((i) => i.done).length;
  const requiredDone = required.filter((i) => i.done).length;
  const total = items.length;
  const requiredTotal = required.length || 1;
  return {
    done,
    total,
    requiredDone,
    requiredTotal,
    percent: Math.round((requiredDone / requiredTotal) * 100),
  };
}

export function nextBetaChecklistItem(
  items: readonly BetaChecklistItem[]
): BetaChecklistItem | null {
  return items.find((i) => !i.done && !i.optional) ?? items.find((i) => !i.done) ?? null;
}
