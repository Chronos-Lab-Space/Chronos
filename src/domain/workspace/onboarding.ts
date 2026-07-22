import type { WorkspaceHome } from "./types";

/**
 * Mandatory onboarding path for Decision Workspace:
 * welcome → name → goal → context → dashboard unlock.
 */
export const ONBOARDING_STEPS = [
  "welcome",
  "name",
  "goal",
  "context",
  "dashboard",
] as const;

export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

/** Workspace exists (name set). */
export function hasWorkspaceContext(home: WorkspaceHome | null): boolean {
  return Boolean(home?.workspace?.id && home.workspace.name?.trim());
}

/**
 * Fully onboarded = workspace + goal + at least one knowledge item or note.
 * Dashboard unlocks only when this is true.
 */
export function isWorkspaceOnboarded(home: WorkspaceHome | null): boolean {
  if (!home?.workspace?.id) return false;
  if (!home.goal?.title?.trim()) return false;
  return home.knowledge.length > 0 || home.notes.length > 0;
}

/**
 * Next required step for the onboarding wizard.
 * Returns "dashboard" when fully onboarded (ready to leave wizard).
 */
export function requiredOnboardingStep(home: WorkspaceHome | null): OnboardingStep {
  if (!home?.workspace?.id) {
    // No workspace yet — show welcome first if they haven't started, then name.
    // Welcome is the entry screen before name; both need no workspace.
    return "welcome";
  }
  if (!home.goal?.title?.trim()) return "goal";
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
export function onboardingProgress(home: WorkspaceHome | null): number {
  if (isWorkspaceOnboarded(home)) return 1;
  const step = requiredOnboardingStep(home);
  // If we're still on welcome/name with no workspace, progress is low
  if (!home?.workspace?.id) {
    return step === "welcome" ? 0 : 1 / (ONBOARDING_STEPS.length - 1);
  }
  const idx = onboardingStepIndex(step);
  return Math.min(1, idx / (ONBOARDING_STEPS.length - 1));
}
