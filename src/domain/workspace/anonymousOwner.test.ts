import { beforeEach, describe, expect, it } from "vitest";
import {
  ANON_OWNER_KEY,
  clearAnonymousOwnerId,
  getOrCreateAnonymousOwnerId,
  isAnonymousOwnerId,
  peekAnonymousOwnerId,
} from "./anonymousOwner";

describe("anonymousOwner", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("creates a uuid on first use and reuses it afterwards", () => {
    const first = getOrCreateAnonymousOwnerId();
    expect(first).toMatch(
      /^anon-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
    // Stable across calls — a new id per call would orphan the workspace.
    expect(getOrCreateAnonymousOwnerId()).toBe(first);
    expect(localStorage.getItem(ANON_OWNER_KEY)).toBe(first);
  });

  it("recognises its own ids and rejects real user ids", () => {
    const anon = getOrCreateAnonymousOwnerId();
    expect(isAnonymousOwnerId(anon)).toBe(true);
    // A Supabase user id must never be mistaken for anonymous — that decides
    // whether cloud writes are structurally disabled.
    expect(isAnonymousOwnerId("11111111-1111-4111-8111-111111111111")).toBe(false);
    expect(isAnonymousOwnerId(null)).toBe(false);
    expect(isAnonymousOwnerId("")).toBe(false);
  });

  it("peek does not create an id", () => {
    // Used on routes that must not mint an identity just by rendering.
    expect(peekAnonymousOwnerId()).toBeNull();
    expect(localStorage.getItem(ANON_OWNER_KEY)).toBeNull();
  });

  it("clears only after work has been claimed", () => {
    const anon = getOrCreateAnonymousOwnerId();
    expect(peekAnonymousOwnerId()).toBe(anon);

    clearAnonymousOwnerId();

    expect(peekAnonymousOwnerId()).toBeNull();
    // A later visit starts a fresh anonymous identity rather than resurrecting.
    expect(getOrCreateAnonymousOwnerId()).not.toBe(anon);
  });

  it("survives storage being unavailable", () => {
    // Private browsing / blocked storage must not break the workspace; the id
    // is then per-session rather than persistent.
    const original = Object.getOwnPropertyDescriptor(window, "localStorage");
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get() {
        throw new Error("storage disabled");
      },
    });

    try {
      const id = getOrCreateAnonymousOwnerId();
      expect(isAnonymousOwnerId(id)).toBe(true);
    } finally {
      if (original) Object.defineProperty(window, "localStorage", original);
    }
  });
});
