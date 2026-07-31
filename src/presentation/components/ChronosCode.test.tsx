import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LANDING_PROGRAM } from "../../domain/chronos/landing-program";
import { compile } from "../../domain/chronos/language";
import { ChronosCode } from "./ChronosCode";

describe("ChronosCode", () => {
  it("renders the source verbatim, so highlighting cannot alter the program", () => {
    // The whole point of rendering from a string: the text a reader sees is the
    // text the compiler test accepts. A highlighter that dropped or reordered a
    // token would put a different program on the page than the one under test.
    const { container } = render(<ChronosCode source={LANDING_PROGRAM} />);

    expect(container.textContent).toBe(LANDING_PROGRAM);
  });

  it("puts a compiling program on the landing page", () => {
    const { container } = render(<ChronosCode source={LANDING_PROGRAM} />);

    // Compile what was actually rendered, not the import — this is the
    // assertion the old hand-built snippet would have failed.
    expect(() => compile(container.textContent ?? "")).not.toThrow();
  });
});
