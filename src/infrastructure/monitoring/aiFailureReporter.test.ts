import { describe, expect, it } from "vitest";
import { severityForAIFailure } from "./aiFailureReporter";

/**
 * Not every failure deserves the same volume. A 503 means someone
 * deliberately switched the provider off — worth seeing, not worth waking
 * up for. A 502 means the upstream broke on its own, which is the case
 * nobody would otherwise notice, because enrichment fails open.
 */
describe("severityForAIFailure", () => {
  it("treats a switched-off provider as information, not a fault", () => {
    expect(severityForAIFailure({ stage: "http", status: 503, message: "off" })).toBe("info");
  });

  it("treats quota and rate limits as warnings", () => {
    expect(severityForAIFailure({ stage: "http", status: 429, message: "slow down" })).toBe(
      "warning"
    );
  });

  it("treats a broken upstream as an error", () => {
    expect(severityForAIFailure({ stage: "http", status: 502, message: "upstream" })).toBe("error");
  });

  it("treats a rejected session as an error — the app believed it was signed in", () => {
    // ProxyAIProvider only reaches the network with a token in hand, so a
    // 401 here means the token was refused, not that nobody was signed in.
    expect(severityForAIFailure({ stage: "http", status: 401, message: "bad jwt" })).toBe("error");
  });

  it("treats a malformed request as an error — that is our bug", () => {
    expect(severityForAIFailure({ stage: "http", status: 400, message: "too long" })).toBe("error");
  });

  it("treats an unreachable proxy as an error", () => {
    expect(severityForAIFailure({ stage: "network", message: "fetch failed" })).toBe("error");
  });

  it("treats a missing proxy URL as a warning — the deploy is misconfigured", () => {
    expect(severityForAIFailure({ stage: "config", message: "VITE_SUPABASE_URL unset" })).toBe(
      "warning"
    );
  });
});
