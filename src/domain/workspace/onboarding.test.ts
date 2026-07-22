import { describe, expect, it } from "vitest";
import {
  ONBOARDING_STEPS,
  hasWorkspaceContext,
  isWorkspaceOnboarded,
  onboardingProgress,
  onboardingStepIndex,
  requiredOnboardingStep,
} from "./onboarding";
import type { WorkspaceHome } from "./types";

function baseHome(overrides: Partial<WorkspaceHome> = {}): WorkspaceHome {
  return {
    workspace: {
      id: "w1",
      owner_id: "u1",
      name: "Chronos Lab",
      description: "",
      created_at: "2026-01-01T00:00:00.000Z",
    },
    goal: null,
    goalHistory: [],
    recentSimulations: [],
    knowledge: [],
    notes: [],
    futuresBySimulation: {},
    timelineBySimulation: {},
    ...overrides,
  };
}

describe("onboarding domain", () => {
  it("exposes the mandatory steps in order", () => {
    expect(ONBOARDING_STEPS).toEqual([
      "welcome",
      "name",
      "goal",
      "context",
      "dashboard",
    ]);
  });

  it("detects workspace context and onboarded state", () => {
    expect(hasWorkspaceContext(null)).toBe(false);
    expect(isWorkspaceOnboarded(null)).toBe(false);

    const wsOnly = baseHome();
    expect(hasWorkspaceContext(wsOnly)).toBe(true);
    expect(isWorkspaceOnboarded(wsOnly)).toBe(false);

    const withGoal = baseHome({
      goal: {
        id: "g1",
        workspace_id: "w1",
        title: "Launch",
        description: "",
        status: "active",
        priority: 1,
        created_at: "2026-01-01T00:00:00.000Z",
      },
    });
    expect(isWorkspaceOnboarded(withGoal)).toBe(false);

    const ready = baseHome({
      goal: withGoal.goal,
      knowledge: [
        {
          id: "k1",
          workspace_id: "w1",
          type: "markdown",
          title: "Brief",
          content: "x",
          metadata: {},
          created_at: "2026-01-02T00:00:00.000Z",
        },
      ],
    });
    expect(isWorkspaceOnboarded(ready)).toBe(true);

    const readyNotes = baseHome({
      goal: withGoal.goal,
      notes: [
        {
          id: "n1",
          workspace_id: "w1",
          title: "Note",
          content: "body",
          created_at: "2026-01-02T00:00:00.000Z",
        },
      ],
    });
    expect(isWorkspaceOnboarded(readyNotes)).toBe(true);
  });

  it("returns required step along the path", () => {
    expect(requiredOnboardingStep(null)).toBe("welcome");
    expect(requiredOnboardingStep(baseHome())).toBe("goal");
    expect(
      requiredOnboardingStep(
        baseHome({
          goal: {
            id: "g1",
            workspace_id: "w1",
            title: "Launch",
            description: "",
            status: "active",
            priority: 1,
            created_at: "2026-01-01T00:00:00.000Z",
          },
        })
      )
    ).toBe("context");
    expect(
      requiredOnboardingStep(
        baseHome({
          goal: {
            id: "g1",
            workspace_id: "w1",
            title: "Launch",
            description: "",
            status: "active",
            priority: 1,
            created_at: "2026-01-01T00:00:00.000Z",
          },
          knowledge: [
            {
              id: "k1",
              workspace_id: "w1",
              type: "note",
              title: "n",
              content: "c",
              metadata: {},
              created_at: "2026-01-02T00:00:00.000Z",
            },
          ],
        })
      )
    ).toBe("dashboard");
  });

  it("indexes steps and reports progress", () => {
    expect(onboardingStepIndex("welcome")).toBe(0);
    expect(onboardingStepIndex("dashboard")).toBe(4);
    expect(onboardingProgress(null)).toBe(0);
    expect(onboardingProgress(baseHome())).toBeGreaterThan(0);
    expect(onboardingProgress(baseHome())).toBeLessThan(1);

    const ready = baseHome({
      goal: {
        id: "g1",
        workspace_id: "w1",
        title: "Launch",
        description: "",
        status: "active",
        priority: 1,
        created_at: "2026-01-01T00:00:00.000Z",
      },
      notes: [
        {
          id: "n1",
          workspace_id: "w1",
          title: "N",
          content: "c",
          created_at: "2026-01-02T00:00:00.000Z",
        },
      ],
    });
    expect(onboardingProgress(ready)).toBe(1);
  });
});
