import { describe, expect, it } from "vitest";
import {
  ONBOARDING_STEPS,
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
    decisions: [],
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
    expect(ONBOARDING_STEPS).toEqual(["welcome", "name", "goal", "context", "dashboard"]);
  });

  it("detects onboarded state by workspace and goal", () => {
    expect(isWorkspaceOnboarded(null)).toBe(false);

    const wsOnly = baseHome();
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
    expect(isWorkspaceOnboarded(withGoal)).toBe(true);
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

describe("workspace onboarded predicate", () => {
  it("is satisfied by a workspace and a goal, with no knowledge or notes", () => {
    const home = {
      workspace: { id: "ws-1", name: "Workspace" },
      goal: { title: "Launch the beta" },
      knowledge: [],
      notes: [],
    } as unknown as WorkspaceHome;

    // Context used to gate this. It no longer does: the first result is what
    // motivates attaching a source, so requiring one first inverted the order.
    expect(isWorkspaceOnboarded(home)).toBe(true);
  });

  it("is not satisfied by a workspace without a goal", () => {
    const home = {
      workspace: { id: "ws-1", name: "Workspace" },
      goal: null,
      knowledge: [],
      notes: [],
    } as unknown as WorkspaceHome;

    expect(isWorkspaceOnboarded(home)).toBe(false);
  });
});

describe("skippable context step", () => {
  const withGoal = () =>
    baseHome({
      goal: {
        id: "g1",
        title: "Launch the beta",
        description: "",
        status: "active",
        created_at: "2026-01-01T00:00:00.000Z",
      },
    } as Partial<WorkspaceHome>);

  it("still asks for context by default", () => {
    // Knowledge genuinely improves ranking, so the step is still offered.
    expect(requiredOnboardingStep(withGoal())).toBe("context");
  });

  it("navigates to dashboard when the visitor skips context", () => {
    // The simulation form already tells users they can run without knowledge.
    // Onboarding must not contradict it by refusing to let them through.
    expect(requiredOnboardingStep(withGoal(), { contextSkipped: true })).toBe("dashboard");
  });

  it("does not let skipping stand in for a goal", () => {
    // Skipping is about context only — the decision itself is the product.
    expect(requiredOnboardingStep(baseHome(), { contextSkipped: true })).toBe("goal");
  });

  it("reports full progress once context is skipped", () => {
    expect(onboardingProgress(withGoal(), { contextSkipped: true })).toBe(1);
  });
});
