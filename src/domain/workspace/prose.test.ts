import { describe, expect, it } from "vitest";
import { toParagraphs } from "./prose";

/**
 * The model is asked for a headline and a body, and `splitBrief` stores the
 * body as one string with blank lines between paragraphs. Rendering that
 * string in a single <p> collapses every blank line to a space, so a
 * three-paragraph brief arrives as one run-on block.
 */
describe("toParagraphs", () => {
  it("splits on blank lines", () => {
    expect(toParagraphs("First para.\n\nSecond para.")).toEqual(["First para.", "Second para."]);
  });

  it("keeps a single paragraph whole", () => {
    expect(toParagraphs("Just the one.")).toEqual(["Just the one."]);
  });

  it("treats a run of blank lines as one break", () => {
    expect(toParagraphs("One.\n\n\n\nTwo.")).toEqual(["One.", "Two."]);
  });

  it("treats a whitespace-only line as blank", () => {
    // Models emit "\n   \n" often enough that ignoring it would put two
    // paragraphs back into one block.
    expect(toParagraphs("One.\n   \nTwo.")).toEqual(["One.", "Two."]);
  });

  it("keeps a soft wrap inside a paragraph — HTML collapses it anyway", () => {
    expect(toParagraphs("A sentence\nwrapped by the model.")).toEqual([
      "A sentence\nwrapped by the model.",
    ]);
  });

  it("returns nothing for absent or empty prose", () => {
    expect(toParagraphs(null)).toEqual([]);
    expect(toParagraphs(undefined)).toEqual([]);
    expect(toParagraphs("")).toEqual([]);
    expect(toParagraphs("   \n\n  ")).toEqual([]);
  });

  it("trims each paragraph", () => {
    expect(toParagraphs("  One.  \n\n  Two.  ")).toEqual(["One.", "Two."]);
  });
});
