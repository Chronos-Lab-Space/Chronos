import { beforeEach, describe, expect, it } from "vitest";
import { allTags, setTags, tagsFor } from "./decisionTagsStore";

describe("decisionTagsStore", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("has no tags for a decision that was never tagged", () => {
    expect(tagsFor("ws-1", "dec-1")).toEqual([]);
  });

  it("stores and reads back tags for a decision", () => {
    setTags("ws-1", "dec-1", ["Funding", "Q3"]);
    expect(tagsFor("ws-1", "dec-1")).toEqual(["Funding", "Q3"]);
  });

  it("trims, dedupes case-insensitively, and sorts", () => {
    setTags("ws-1", "dec-1", [" Funding ", "funding", "", "Q3", "Q3"]);
    expect(tagsFor("ws-1", "dec-1")).toEqual(["Funding", "Q3"]);
  });

  it("clears a decision's tags when set to empty", () => {
    setTags("ws-1", "dec-1", ["Funding"]);
    setTags("ws-1", "dec-1", []);
    expect(tagsFor("ws-1", "dec-1")).toEqual([]);
  });

  it("keeps tags scoped to their workspace", () => {
    setTags("ws-1", "dec-1", ["Funding"]);
    expect(tagsFor("ws-2", "dec-1")).toEqual([]);
  });

  it("keeps tags scoped to their decision", () => {
    setTags("ws-1", "dec-1", ["Funding"]);
    expect(tagsFor("ws-1", "dec-2")).toEqual([]);
  });

  it("lists every distinct tag in use across a workspace", () => {
    setTags("ws-1", "dec-1", ["Funding", "Q3"]);
    setTags("ws-1", "dec-2", ["Hiring", "Q3"]);
    expect(allTags("ws-1")).toEqual(["Funding", "Hiring", "Q3"]);
  });

  it("returns nothing for an unknown workspace", () => {
    expect(allTags("ws-nope")).toEqual([]);
  });
});
