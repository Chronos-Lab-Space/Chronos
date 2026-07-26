import { describe, expect, it } from "vitest";
import { stableUuidFromSeed } from "./stableUuid";

describe("stableUuidFromSeed", () => {
  it("is deterministic and uuid-shaped", () => {
    const a = stableUuidFromSeed("learning:outcome:s1:f1");
    const b = stableUuidFromSeed("learning:outcome:s1:f1");
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  });
});
