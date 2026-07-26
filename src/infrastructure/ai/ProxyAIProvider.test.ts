import { describe, expect, it, vi } from "vitest";
import { AICapabilityError, AIProviderError } from "../../domain/ai/errors";
import { ProxyAIProvider } from "./ProxyAIProvider";

const PROXY = "https://project.supabase.co/functions/v1/ai-generate";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function providerWith(fetchImpl: unknown, token: string | null = "session-token") {
  return new ProxyAIProvider({
    proxyUrl: PROXY,
    getAccessToken: async () => token,
    fetchImpl: fetchImpl as typeof fetch,
  });
}

function bodyOf(fetchImpl: ReturnType<typeof vi.fn>): Record<string, unknown> {
  const call = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
  return JSON.parse(String(call[1].body));
}

function headersOf(fetchImpl: ReturnType<typeof vi.fn>): Record<string, string> {
  const call = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
  return call[1].headers as Record<string, string>;
}

describe("ProxyAIProvider", () => {
  it("maps the proxy response and sends the session token", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({
        text: "Ship the staged beta.",
        model: "claude-opus-5",
        usage: { promptTokens: 356, completionTokens: 118 },
      })
    );
    const ai = providerWith(fetchImpl);

    const r = await ai.generate({ prompt: "hi", system: "be brief", maxTokens: 280 });

    expect(r.text).toBe("Ship the staged beta.");
    expect(r.model).toBe("claude-opus-5");
    expect(r.provider).toBe("proxy");
    expect(r.usage).toEqual({ promptTokens: 356, completionTokens: 118 });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const call = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(call[0]).toBe(PROXY);
    expect(call[1].method).toBe("POST");
    expect(headersOf(fetchImpl).Authorization).toBe("Bearer session-token");

    const body = bodyOf(fetchImpl);
    expect(body.prompt).toBe("hi");
    expect(body.system).toBe("be brief");
    expect(body.maxTokens).toBe(280);
  });

  it("never forwards temperature or model — both are 400s or server-owned", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ text: "ok", model: "claude-opus-5" }));
    const ai = providerWith(fetchImpl);

    // The exact request SimulationEngine.maybeEnrichRecommendation builds:
    // it still carries temperature because the Ollama adapter uses it.
    await ai.generate({ prompt: "p", system: "s", temperature: 0.4, maxTokens: 280 });

    const body = bodyOf(fetchImpl);
    expect(body).not.toHaveProperty("temperature");
    expect(body).not.toHaveProperty("model");
    expect(Object.keys(body).sort()).toEqual(["maxTokens", "prompt", "system"]);
  });

  it("throws without a session, before any request goes out", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ text: "should not happen" }));
    const ai = providerWith(fetchImpl, null);

    await expect(ai.generate({ prompt: "x" })).rejects.toBeInstanceOf(AIProviderError);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("throws when no proxy URL is configured", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ text: "no" }));
    const ai = new ProxyAIProvider({
      getAccessToken: async () => "t",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    await expect(ai.generate({ prompt: "x" })).rejects.toBeInstanceOf(AIProviderError);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("surfaces the proxy's own message and status on 429", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ error: "quota_exceeded", message: "Monthly AI allowance reached." }, 429)
    );
    const ai = providerWith(fetchImpl);

    await expect(ai.generate({ prompt: "x" })).rejects.toMatchObject({
      name: "AIProviderError",
      provider: "proxy",
      status: 429,
    });
    await expect(providerWith(fetchImpl).generate({ prompt: "x" })).rejects.toThrow(
      /Monthly AI allowance reached/
    );
  });

  it("throws AIProviderError on a 5xx with a non-JSON body", async () => {
    const fetchImpl = vi.fn(async () => new Response("upstream down", { status: 502 }));
    const ai = providerWith(fetchImpl);

    await expect(ai.generate({ prompt: "x" })).rejects.toMatchObject({
      name: "AIProviderError",
      status: 502,
    });
  });

  it("throws AIProviderError when the proxy is unreachable", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError("fetch failed");
    });
    const ai = providerWith(fetchImpl);

    await expect(ai.generate({ prompt: "x" })).rejects.toMatchObject({
      name: "AIProviderError",
      provider: "proxy",
    });
  });

  it("resolves with empty text on a refusal rather than throwing", async () => {
    // The proxy answers a refusal with 200 + text:"" so the engine's
    // fail-open path keeps the deterministic recommendation.
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ text: "", model: "claude-opus-5", usage: {} })
    );
    const ai = providerWith(fetchImpl);

    const r = await ai.generate({ prompt: "x" });
    expect(r.text).toBe("");
    expect(r.usage).toEqual({ promptTokens: undefined, completionTokens: undefined });
  });

  it("does not support embeddings", async () => {
    const ai = providerWith(vi.fn());
    await expect(ai.embed({ input: "x" })).rejects.toBeInstanceOf(AICapabilityError);
  });

  it("reason and code route through generate with a system preamble", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ text: "ok", model: "claude-opus-5" }));
    const ai = providerWith(fetchImpl);

    await ai.reason({ prompt: "p", schemaHint: "{a:1}" });
    expect(String(bodyOf(fetchImpl).system)).toContain("Reason step by step");
    expect(String(bodyOf(fetchImpl).system)).toContain("{a:1}");

    fetchImpl.mockClear();
    await ai.code({ prompt: "p", language: "ts" });
    expect(String(bodyOf(fetchImpl).system)).toContain("Language: ts.");
  });
});
