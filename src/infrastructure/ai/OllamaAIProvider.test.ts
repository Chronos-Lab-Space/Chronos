import { describe, expect, it, vi } from "vitest";
import { AIProviderError } from "../../domain/ai/errors";
import { OllamaAIProvider } from "./OllamaAIProvider";

describe("OllamaAIProvider", () => {
  it("maps /api/generate response", async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(JSON.stringify({ response: "hello from ollama", model: "llama3.2:1b" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
    );
    const ai = new OllamaAIProvider({
      baseUrl: "http://127.0.0.1:11434",
      defaultModel: "llama3.2:1b",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    const r = await ai.generate({ prompt: "hi", system: "be brief" });
    expect(r.text).toBe("hello from ollama");
    expect(r.provider).toBe("ollama");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const call = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    const body = JSON.parse(String(call[1].body));
    expect(body.stream).toBe(false);
    expect(body.prompt).toBe("hi");
    expect(body.system).toBe("be brief");
  });

  it("throws AIProviderError on HTTP failure", async () => {
    const fetchImpl = vi.fn(
      async () => new Response("down", { status: 503 })
    ) as unknown as typeof fetch;
    const ai = new OllamaAIProvider({ fetchImpl });
    await expect(ai.generate({ prompt: "x" })).rejects.toBeInstanceOf(AIProviderError);
  });

  it("throws AIProviderError when server unreachable", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError("fetch failed");
    }) as unknown as typeof fetch;
    const ai = new OllamaAIProvider({ fetchImpl });
    await expect(ai.generate({ prompt: "x" })).rejects.toMatchObject({
      name: "AIProviderError",
      provider: "ollama",
    });
  });
});
