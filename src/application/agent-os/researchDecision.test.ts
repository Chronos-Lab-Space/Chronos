import { describe, expect, it } from "vitest";
import { CapabilityRegistration, type Task } from "../../domain/chronos/task-os";
import { CapabilityRegistry } from "./AgentOperatingSystem";
import { researchDecision } from "./researchDecision";

function registryReturning(output: Record<string, unknown>): CapabilityRegistry {
  const registry = new CapabilityRegistry();
  registry.register(
    new CapabilityRegistration({
      id: "cap-research",
      providerId: "test",
      name: "Research",
      version: "1.0.0",
      taskKinds: ["research.competitors"],
      capabilityKeys: [],
      description: "test double",
    }),
    async () => output
  );
  return registry;
}

describe("researchDecision", () => {
  it("returns the findings the capability produced", async () => {
    const result = await researchDecision(
      registryReturning({ findings: ["Incumbent owns distribution", "Switching cost is low"] }),
      { objective: "Launch a developer tool" }
    );

    expect(result.findings).toEqual(["Incumbent owns distribution", "Switching cost is low"]);
  });

  it("returns nothing rather than inventing findings when the provider is a stub", async () => {
    // The registry resolves offline too — the research agent falls back to a
    // stub summary with no findings. Presenting that as research would be the
    // dishonest option; an empty result lets the caller say nothing at all.
    const result = await researchDecision(registryReturning({ findings: [], source: "stub" }), {
      objective: "Launch a developer tool",
    });

    expect(result.findings).toEqual([]);
    expect(result.source).toBe("stub");
  });

  it("survives a capability that throws", async () => {
    const registry = new CapabilityRegistry();
    registry.register(
      new CapabilityRegistration({
        id: "cap-research",
        providerId: "test",
        name: "Research",
        version: "1.0.0",
        taskKinds: ["research.competitors"],
        capabilityKeys: [],
        description: "test double",
      }),
      async (_task: Task) => {
        throw new Error("upstream down");
      }
    );

    // Research is an addition to a decision that already stands. An outage
    // must degrade to nothing, never surface as a failure the user must clear.
    await expect(
      researchDecision(registry, { objective: "Launch a developer tool" })
    ).resolves.toEqual({ findings: [], source: "stub" });
  });

  it("refuses an empty objective without dispatching", async () => {
    let dispatched = false;
    const registry = new CapabilityRegistry();
    registry.register(
      new CapabilityRegistration({
        id: "cap-research",
        providerId: "test",
        name: "Research",
        version: "1.0.0",
        taskKinds: ["research.competitors"],
        capabilityKeys: [],
        description: "test double",
      }),
      async () => {
        dispatched = true;
        return { findings: ["should not happen"] };
      }
    );

    const result = await researchDecision(registry, { objective: "   " });

    expect(dispatched).toBe(false);
    expect(result.findings).toEqual([]);
  });
});
