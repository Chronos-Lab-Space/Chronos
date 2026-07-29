import { describe, expect, it } from "vitest";
import { simulate } from "./startup-sim";

/**
 * What the path catalog actually covers.
 *
 * `startup-sim` was built for the public "simulate a startup idea" demo, and
 * its seven catalogs are startup archetypes. The workspace engine runs the same
 * code against arbitrary business decisions, which produces two failure modes:
 *
 *  1. **Silent fallback.** `categorize()` starts at "b2b-saas" with score 0 and
 *     only moves if a keyword matches, so any decision outside the keyword
 *     lists becomes a B2B SaaS go-to-market decision.
 *  2. **Spurious match.** Classification is a single keyword hit regardless of
 *     meaning — "hire" is a marketplace keyword, so a hiring decision gets
 *     supply-and-demand marketplace strategies.
 *
 * These tests assert current behaviour so the limit is visible in the suite
 * rather than discovered by a beta user. They are not an endorsement of it.
 */
describe("path catalog coverage", () => {
  it("matches a catalog when the objective genuinely names one", () => {
    expect(simulate("Should we build an AI code review tool for developers?").category).toBe(
      "ai-dev-tools"
    );
  });

  it("falls back to B2B SaaS for decisions outside every keyword list", () => {
    // None of these is a go-to-market question; all three receive go-to-market
    // archetypes with the objective appended.
    for (const objective of [
      "Should we open a second office in Berlin?",
      "Do we rebuild the mobile app in React Native?",
      "Should we switch our database from Postgres to MySQL?",
    ]) {
      expect(simulate(objective).category).toBe("b2b-saas");
    }
  });

  it("classifies on a single keyword regardless of meaning", () => {
    // "hire" belongs to the marketplace list, so a hiring decision is treated
    // as a two-sided marketplace. This is the more misleading failure: it looks
    // like a deliberate match rather than a fallback.
    expect(simulate("Should we hire a contractor or a full-time designer?").category).toBe(
      "marketplace"
    );
    // "team" belongs to the productivity list.
    expect(simulate("How should we launch our public beta with a small team?").category).toBe(
      "productivity"
    );
  });

  it("varies only the appended objective between unrelated fallback decisions", () => {
    // The archetypes are identical across unrelated decisions; only the suffix
    // differs. Records are fresh; the strategies are not.
    const strip = (name: string) => name.split("·")[0]!.trim();
    const names = (objective: string) => {
      const r = simulate(objective);
      return [r.bestPath, ...r.alternatives].map((p) => strip(p.name));
    };

    expect(names("Should we open a second office in Berlin?")).toEqual(
      names("Do we rebuild the mobile app in React Native?")
    );
  });
});
