/**
 * Public beta onboarding checklist — unlock progress naturally (not a tutorial).
 *
 * Create first decision → Run first simulation → Save memory → Share workspace
 */
import type { WorkspaceHome } from "./types";
import { withoutSampleSimulations } from "./sampleDecision";

export type BetaChecklistId = "decision" | "simulation" | "memory" | "share";

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
  shareAcknowledged: boolean;
  preferredAuthProvider: string | null;
  /** Visitor chose "skip for now" on the onboarding context step. */
  onboardingContextSkipped: boolean;
};

export const DEFAULT_PREFERENCES: UserPreferences = {
  shareAcknowledged: false,
  preferredAuthProvider: null,
  onboardingContextSkipped: false,
};

export function evaluateBetaChecklist(
  home: WorkspaceHome | null,
  prefs: UserPreferences = DEFAULT_PREFERENCES
): BetaChecklistItem[] {
  // The seeded sample demonstrates the loop; it is not evidence the user ran
  // it. Counting it would tell a new visitor they had finished onboarding they
  // never did.
  const ownSimulations = withoutSampleSimulations(home?.recentSimulations ?? []);
  const hasDecision = Boolean(home?.goal?.title?.trim());
  const hasSimulation = ownSimulations.length > 0;
  const hasSavedMemory = ownSimulations.some(
    (s) =>
      Boolean(s.result.chosen_future_id) ||
      Boolean(s.result.outcome_followed) ||
      Boolean(s.result.outcome_result)
  );

  return [
    {
      id: "decision",
      label: "Create first decision",
      detail: "What decision are you trying to make?",
      optional: false,
      done: hasDecision,
      href: "/workspace",
      cta: hasDecision ? "Open" : "Set decision",
    },
    {
      id: "simulation",
      label: "Run first simulation",
      detail: "Generate futures, evaluate trade-offs, read the Decision Report.",
      optional: false,
      done: hasSimulation,
      href: "/workspace/simulations?new=1",
      cta: hasSimulation ? "Simulations" : "Generate futures",
    },
    {
      id: "memory",
      label: "Save decision",
      detail: "Choose a path so Chronos records the decision in workspace memory.",
      optional: false,
      done: hasSavedMemory,
      href: hasSimulation
        ? `/workspace/simulations/${ownSimulations[0]!.id}`
        : "/workspace/simulations?new=1",
      cta: hasSavedMemory ? "Memory" : "Save path",
    },
    {
      id: "share",
      label: "Share workspace",
      detail: "Copy a public-beta share note for a teammate (full invites later).",
      optional: true,
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
