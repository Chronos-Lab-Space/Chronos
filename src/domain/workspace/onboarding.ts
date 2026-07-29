import type { WorkspaceHome } from "./types";

/**
 * Onboarding path for Decision Workspace:
 * welcome → name → goal → context → dashboard unlock.
 *
 * Workspace and goal are required — the decision is the product. Context is
 * offered but skippable: knowledge improves ranking, and the simulation form
 * already says so ("you can still run without it"), so gating the whole
 * workspace on it made the product contradict itself and put four forms
 * between a new user and their first simulation.
 */
export const ONBOARDING_STEPS = ["welcome", "name", "goal", "context", "dashboard"] as const;

export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

export type OnboardingOptions = {
  /** The visitor chose "skip for now" on the context step. */
  contextSkipped?: boolean;
};

/** Workspace exists (name set). */
export function hasWorkspaceContext(home: WorkspaceHome | null): boolean {
  return Boolean(home?.workspace?.id && home.workspace.name?.trim());
}

/**
 * Fully onboarded = workspace + goal + at least one knowledge item or note.
 * Dashboard unlocks only when this is true.
 */
export function isWorkspaceOnboarded(
  home: WorkspaceHome | null,
  options: OnboardingOptions = {}
): boolean {
  if (!home?.workspace?.id) return false;
  if (!home.goal?.title?.trim()) return false;
  if (options.contextSkipped) return true;
  return home.knowledge.length > 0 || home.notes.length > 0;
}

/**
 * Next required step for the onboarding wizard.
 * Returns "dashboard" when fully onboarded (ready to leave wizard).
 */
export function requiredOnboardingStep(
  home: WorkspaceHome | null,
  options: OnboardingOptions = {}
): OnboardingStep {
  if (!home?.workspace?.id) {
    // No workspace yet — show welcome first if they haven't started, then name.
    // Welcome is the entry screen before name; both need no workspace.
    return "welcome";
  }
  // Skipping is about context only. A workspace with no decision has nothing
  // to simulate, so the goal stays required.
  if (!home.goal?.title?.trim()) return "goal";
  if (options.contextSkipped) return "dashboard";
  if (home.knowledge.length === 0 && home.notes.length === 0) return "context";
  return "dashboard";
}

export function onboardingStepIndex(step: OnboardingStep): number {
  const idx = ONBOARDING_STEPS.indexOf(step);
  return idx < 0 ? 0 : idx;
}

/**
 * Progress 0–1 for the current home state.
 * Welcome counts as step 0; dashboard = 1.
 */
export function onboardingProgress(
  home: WorkspaceHome | null,
  options: OnboardingOptions = {}
): number {
  if (isWorkspaceOnboarded(home, options)) return 1;
  const step = requiredOnboardingStep(home, options);
  // If we're still on welcome/name with no workspace, progress is low
  if (!home?.workspace?.id) {
    return step === "welcome" ? 0 : 1 / (ONBOARDING_STEPS.length - 1);
  }
  const idx = onboardingStepIndex(step);
  return Math.min(1, idx / (ONBOARDING_STEPS.length - 1));
}
