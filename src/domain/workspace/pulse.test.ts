import { describe, expect, it } from "vitest";
import {
  computeKnowledgeCoverage,
  computeWorkspacePulse,
  countOpenTasks,
  formatRelativeTime,
} from "./pulse";
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
    goal: {
      id: "g1",
      workspace_id: "w1",
      title: "Launch CLAB on Kickstart",
      description: "",
      status: "active",
      priority: 1,
      created_at: "2026-01-01T12:00:00.000Z",
    },
    goalHistory: [],
    recentSimulations: [],
    knowledge: [],
    notes: [],
    futuresBySimulation: {},
    timelineBySimulation: {},
    ...overrides,
  };
}

describe("Workspace Pulse", () => {
  it("frames the active decision, not a chat greeting", () => {
    const pulse = computeWorkspacePulse(baseHome());
    expect(pulse.decisionTitle).toBe("Launch CLAB on Kickstart");
    expect(pulse.knowledgeCoverage).toBe(0);
    expect(pulse.simulationConfidence).toBe(0);
    expect(pulse.openTasks).toBeGreaterThan(0);
    expect(pulse.recommendation.toLowerCase()).toMatch(/context|evidence|add/);
  });

  it("raises knowledge coverage with diverse sources + depth", () => {
    const thin = baseHome({
      knowledge: [
        {
          id: "k1",
          workspace_id: "w1",
          type: "markdown",
          title: "Brief",
          content: "x".repeat(200),
          metadata: {},
          created_at: "2026-01-02T00:00:00.000Z",
        },
      ],
    });
    expect(computeKnowledgeCoverage(thin)).toBeGreaterThan(0);
    expect(computeKnowledgeCoverage(thin)).toBeLessThan(50);

    const rich = baseHome({
      knowledge: [
        ...Array.from({ length: 5 }, (_, i) => ({
          id: `d${i}`,
          workspace_id: "w1",
          type: "markdown" as const,
          title: `Doc ${i}`,
          content: "y".repeat(800),
          metadata: {},
          created_at: "2026-01-02T00:00:00.000Z",
        })),
        {
          id: "u1",
          workspace_id: "w1",
          type: "url",
          title: "https://example.com",
          content: "site",
          metadata: { url: "https://example.com" },
          created_at: "2026-01-02T00:00:00.000Z",
        },
        {
          id: "u2",
          workspace_id: "w1",
          type: "url",
          title: "https://docs.example.com",
          content: "docs",
          metadata: { url: "https://docs.example.com" },
          created_at: "2026-01-02T00:00:00.000Z",
        },
      ],
      notes: [
        {
          id: "n1",
          workspace_id: "w1",
          title: "N1",
          content: "note body",
          created_at: "2026-01-02T00:00:00.000Z",
        },
        {
          id: "n2",
          workspace_id: "w1",
          title: "N2",
          content: "note body",
          created_at: "2026-01-02T00:00:00.000Z",
        },
        {
          id: "n3",
          workspace_id: "w1",
          title: "N3",
          content: "note body",
          created_at: "2026-01-02T00:00:00.000Z",
        },
      ],
    });
    expect(computeKnowledgeCoverage(rich)).toBeGreaterThanOrEqual(80);
  });

  it("surfaces simulation confidence and path-choice open work", () => {
    const home = baseHome({
      knowledge: [
        {
          id: "k1",
          workspace_id: "w1",
          type: "markdown",
          title: "Brief",
          content: "context",
          metadata: {},
          created_at: "2026-01-02T00:00:00.000Z",
        },
      ],
      recentSimulations: [
        {
          id: "s1",
          workspace_id: "w1",
          goal_id: "g1",
          title: "Raise first?",
          status: "completed",
          confidence: 0.91,
          result: { best_future: "Private Beta First" },
          created_at: "2026-01-03T00:00:00.000Z",
          version: 1,
          lineage_id: "L1",
          parent_simulation_id: null,
        },
      ],
      futuresBySimulation: {
        s1: [
          {
            id: "f1",
            simulation_id: "s1",
            name: "Private Beta First",
            score: 0.9,
            risk: 0.2,
            confidence: 0.91,
            summary: "Ship private beta",
          },
        ],
      },
    });

    const pulse = computeWorkspacePulse(home);
    expect(pulse.simulationConfidence).toBe(91);
    expect(pulse.recommendation.toLowerCase()).toMatch(/choose|path|compare|suggests/);
    expect(countOpenTasks(home)).toBeGreaterThan(0);
  });

  it("uses engine recommendation when the loop is mature", () => {
    const home = baseHome({
      knowledge: [
        {
          id: "k1",
          workspace_id: "w1",
          type: "markdown",
          title: "Brief",
          content: "x".repeat(500),
          metadata: {},
          created_at: "2026-01-02T00:00:00.000Z",
        },
        {
          id: "u1",
          workspace_id: "w1",
          type: "url",
          title: "https://chronoslab.space",
          content: "site",
          metadata: {},
          created_at: "2026-01-02T00:00:00.000Z",
        },
      ],
      notes: [
        {
          id: "n1",
          workspace_id: "w1",
          title: "Constraints",
          content: "No raise before launch",
          created_at: "2026-01-02T00:00:00.000Z",
        },
      ],
      recentSimulations: [
        {
          id: "s2",
          workspace_id: "w1",
          goal_id: "g1",
          title: "Raise first?",
          status: "completed",
          confidence: 0.91,
          result: {
            best_future: "Private Beta First",
            chosen_future_id: "f1",
            chosen_future_name: "Private Beta First",
            chosen_at: "2026-01-04T01:00:00.000Z",
            recommendation: "Continue building the MVP dashboard.",
            outcome_followed: "yes",
            outcome_followed_at: "2026-01-05T00:00:00.000Z",
            outcome_result: "Shipped private beta on schedule.",
            outcome_result_at: "2026-01-10T00:00:00.000Z",
          },
          created_at: "2026-01-04T00:00:00.000Z",
          version: 2,
          lineage_id: "L1",
          parent_simulation_id: "s1",
        },
        {
          id: "s1",
          workspace_id: "w1",
          goal_id: "g1",
          title: "Raise first?",
          status: "completed",
          confidence: 0.8,
          result: {
            best_future: "Private Beta First",
            chosen_future_id: "f1",
            outcome_followed: "yes",
            outcome_result: "ok",
          },
          created_at: "2026-01-03T00:00:00.000Z",
          version: 1,
          lineage_id: "L1",
          parent_simulation_id: null,
        },
      ],
      futuresBySimulation: {
        s2: [
          {
            id: "f1",
            simulation_id: "s2",
            name: "Private Beta First",
            score: 0.9,
            risk: 0.2,
            confidence: 0.91,
            summary: "Ship private beta",
          },
        ],
      },
    });

    const pulse = computeWorkspacePulse(home);
    expect(pulse.lastUpdatedAt).toBe("2026-01-04T01:00:00.000Z");
    expect(pulse.simulationConfidence).toBe(91);
    expect(pulse.recommendation).toBe("Continue building the MVP dashboard.");
  });

  it("formats relative last-updated times", () => {
    const now = Date.parse("2026-01-10T12:00:00.000Z");
    expect(formatRelativeTime("2026-01-10T10:00:00.000Z", now)).toBe("2 hours ago");
    expect(formatRelativeTime("2026-01-10T11:45:00.000Z", now)).toBe("15 minutes ago");
    expect(formatRelativeTime(null, now)).toBe("—");
  });
});
