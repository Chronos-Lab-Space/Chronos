import { describe, expect, it } from "vitest";
import { NoopAIProvider } from "./NoopAIProvider";

describe("NoopAIProvider", () => {
  const ai = new NoopAIProvider();

  it("generate returns empty text without network", async () => {
    const r = await ai.generate({ prompt: "hello" });
    expect(r.text).toBe("");
    expect(r.provider).toBe("noop");
    expect(r.model).toBe("noop");
  });

  it("embed returns empty vectors", async () => {
    const r = await ai.embed({ input: "x" });
    expect(r.vectors).toEqual([]);
  });

  it("reason and code delegate to empty generate", async () => {
    await expect(ai.reason({ prompt: "why" })).resolves.toMatchObject({ text: "" });
    await expect(ai.code({ prompt: "fn", language: "ts" })).resolves.toMatchObject({
      text: "",
    });
  });
});
