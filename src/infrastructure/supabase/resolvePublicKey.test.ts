import { describe, expect, it } from "vitest";
import { resolvePublicKey } from "./client";

/**
 * The legacy anon JWT is being replaced by publishable keys
 * (`sb_publishable_...`). Both work today, so a migration means setting the
 * new one while the old one is still in place — and during that overlap the
 * new key has to win, or rotating changes nothing and looks like it worked.
 */
describe("resolvePublicKey", () => {
  it("prefers the publishable key when both are set", () => {
    expect(
      resolvePublicKey({
        VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_new",
        VITE_SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiJ9.legacy",
      })
    ).toBe("sb_publishable_new");
  });

  it("falls back to the legacy anon key while it is the only one set", () => {
    expect(resolvePublicKey({ VITE_SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiJ9.legacy" })).toBe(
      "eyJhbGciOiJIUzI1NiJ9.legacy"
    );
  });

  it("uses the publishable key alone once the legacy one is removed", () => {
    expect(resolvePublicKey({ VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_new" })).toBe(
      "sb_publishable_new"
    );
  });

  it("treats an empty string as missing", () => {
    // CI injects unset Actions secrets as "", which would otherwise shadow
    // the committed .env.production value.
    expect(
      resolvePublicKey({
        VITE_SUPABASE_PUBLISHABLE_KEY: "  ",
        VITE_SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiJ9.legacy",
      })
    ).toBe("eyJhbGciOiJIUzI1NiJ9.legacy");
  });

  it("returns undefined when neither is present", () => {
    expect(resolvePublicKey({})).toBeUndefined();
  });
});
