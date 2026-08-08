import { describe, expect, it, vi } from "vitest";
import type { AIProviderId } from "./createAIPort";
import { createAIPortFromEnv } from "./createAIPort";
import type { ProviderRouter } from "./ProviderRouter";

/** createAIPortFromEnv always returns the router; this reads its default. */
function activeId(port: ReturnType<typeof createAIPortFromEnv>): string {
  return (port as ProviderRouter).activeProviderId;
}

describe("createAIPortFromEnv", () => {
  it("defaults to noop so sims stay deterministic", () => {
    expect(activeId(createAIPortFromEnv())).toBe("noop");
  });

  it("resolves the proxy adapter when selected", () => {
    const port = createAIPortFromEnv({ provider: "proxy" });
    expect(activeId(port)).toBe("proxy");
    expect((port as ProviderRouter).resolve("proxy").id).toBe("proxy");
  });

  it('still accepts the legacy "anthropic" value', () => {
    // The proxy gained a second upstream, so the browser no longer knows
    // which vendor answers. Existing configs must not break for it.
    expect(activeId(createAIPortFromEnv({ provider: "anthropic" }))).toBe("proxy");
  });

  it("falls back to noop on an unknown provider rather than throwing", () => {
    // A typo in VITE_AI_PROVIDER must degrade to deterministic prose,
    // not break every simulation.
    const port = createAIPortFromEnv({ provider: "grok" as AIProviderId });
    expect(activeId(port)).toBe("noop");
  });

  it("posts to the configured proxy URL with the session token", async () => {
    const fetchSpy = vi.fn(
      async () =>
        new Response(JSON.stringify({ text: "ok", model: "claude-opus-5" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
    );
    // Stub before constructing — the adapter binds fetch in its constructor.
    vi.stubGlobal("fetch", fetchSpy);
    try {
      const port = createAIPortFromEnv({
        provider: "proxy",
        proxyUrl: "https://example.supabase.co/functions/v1/ai-generate",
        getAccessToken: async () => "token",
      });
      const result = await port.generateTask({
        task: "sim.recommendation",
        fields: { objective: "x" },
      });

      expect(result.text).toBe("ok");
      const [url, init] = fetchSpy.mock.calls[0] as unknown as [string, RequestInit];
      expect(url).toBe("https://example.supabase.co/functions/v1/ai-generate");
      expect((init.headers as Record<string, string>).Authorization).toBe("Bearer token");
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
