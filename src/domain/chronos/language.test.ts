import { describe, expect, it } from "vitest";
import { compile } from "./language";

describe("Chronos language safety", () => {
  it("blocks prototype pollution through action mutation paths", () => {
    const compiled = compile(`
      action "poison" {
        agent.__proto__.polluted = 1
      }
    `);
    expect(() => compiled.actions[0].apply(compiled.initialState)).toThrow(/reserved/i);
    expect("polluted" in {}).toBe(false);
  });

  it("blocks prototype pollution through constructor and prototype keys", () => {
    for (const key of ["constructor", "prototype"]) {
      const compiled = compile(`
        action "poison" {
          agent.${key}.polluted = 1
        }
      `);
      expect(() => compiled.actions[0].apply(compiled.initialState)).toThrow(/reserved/i);
    }
    expect("polluted" in {}).toBe(false);
  });
});
