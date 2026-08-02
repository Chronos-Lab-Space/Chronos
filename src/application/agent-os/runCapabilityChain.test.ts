import { describe, expect, it } from "vitest";
import { NoopAIProvider } from "../../domain/ai/NoopAIProvider";
import { createDefaultCapabilityRegistry } from "./createDefaultCapabilityRegistry";
import { runCapabilityChain } from "./runCapabilityChain";

describe("runCapabilityChain", () => {
  it("runs research then plan with prior output available (noop → empty plan)", async () => {
    const registry = createDefaultCapabilityRegistry({ ai: new NoopAIProvider() });
    const result = await runCapabilityChain(registry, [
      {
        id: "r1",
        kind: "research.competitors",
        capability: "research.competitors",
        title: "Research",
        input: () => ({ prompt: "Launch pricing" }),
      },
      {
        id: "p1",
        kind: "plan",
        capability: "plan",
        title: "Plan",
        input: (prior) => ({
          objective: "Launch pricing · Invite path",
          researchContext: Array.isArray(prior.r1?.findings)
            ? (prior.r1.findings as string[]).join("\n")
            : "",
        }),
      },
    ]);

    // Noop research returns empty findings; plan stub returns no steps — chain still completes.
    expect(result.ok).toBe(true);
    expect(result.steps).toHaveLength(2);
    expect(result.steps[0].status).toBe("completed");
    expect(result.steps[1].status).toBe("completed");
  });
});
