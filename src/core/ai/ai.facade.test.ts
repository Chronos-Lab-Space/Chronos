import { beforeEach, describe, expect, it } from "vitest";
import { NoopAIProvider } from "../../domain/ai";
import { resetDefaultAIPort } from "../../infrastructure/ai";
import { ai } from "./index";

describe("core/ai facade", () => {
  beforeEach(() => {
    resetDefaultAIPort();
  });

  it("delegates generate to the platform AIPort (noop by default)", async () => {
    const response = await ai.generate({
      model: "reasoning",
      prompt: "Rank futures",
      context: { workspaceId: "w1" },
    });
    expect(response.provider).toBe("noop");
    expect(response.text).toBe("");
    expect(response.model).toBe("noop");
  });

  it("exposes domain NoopAIProvider identity", () => {
    expect(new NoopAIProvider().id).toBe("noop");
  });
});
