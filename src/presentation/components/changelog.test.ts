import { describe, expect, it } from "vitest";
import pkg from "../../../package.json";
import { releases } from "./Changelog";

/**
 * The changelog is hand-maintained and user-facing, and nothing enforced it.
 * It drifted four releases ahead of package.json, and then fourteen merged
 * PRs went unlogged — including a new product surface. These are the cheapest
 * checks that would have caught both.
 */

function toParts(version: string): number[] {
  return version.split(".").map(Number);
}

/** Descending semver comparison; 0 when equal. */
function compare(a: string, b: string): number {
  const [x, y] = [toParts(a), toParts(b)];
  for (let i = 0; i < 3; i++) {
    if ((x[i] ?? 0) !== (y[i] ?? 0)) return (y[i] ?? 0) - (x[i] ?? 0);
  }
  return 0;
}

describe("changelog", () => {
  it("matches the version in package.json", () => {
    // Not a style rule: shipping a release the manifest has never heard of is
    // how you end up unable to say what is deployed.
    expect(releases[0].version).toBe(pkg.version);
  });

  it("is ordered newest first", () => {
    const versions = releases.map((r) => r.version);
    expect(versions).toEqual([...versions].sort(compare));
  });

  it("has no duplicate versions", () => {
    const versions = releases.map((r) => r.version);
    expect(new Set(versions).size).toBe(versions.length);
  });

  it("gives every release a real date, a semver, and something to read", () => {
    for (const release of releases) {
      expect(release.version, release.title).toMatch(/^\d+\.\d+\.\d+$/);
      expect(release.date, release.version).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(Number.isNaN(Date.parse(release.date)), release.version).toBe(false);
      expect(release.title.trim().length, release.version).toBeGreaterThan(0);
      expect(release.summary.trim().length, release.version).toBeGreaterThan(0);
      expect(release.highlights.length, release.version).toBeGreaterThan(0);
    }
  });

  it("does not date a release in the future", () => {
    // A copy-paste that lands a release in 2027 would otherwise sit at the top
    // of the page indefinitely.
    const newest = Date.parse(releases[0].date);
    expect(newest).toBeLessThanOrEqual(Date.now() + 86_400_000);
  });
});
