import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
  DEFAULT_REVIEW_HORIZON,
  REVIEW_HORIZONS,
} from "../../../../domain/workspace/outcomeReview";
import { ReviewHorizonPicker } from "./ReviewHorizonPicker";

describe("ReviewHorizonPicker", () => {
  it("offers every horizon and marks the given one selected", () => {
    render(<ReviewHorizonPicker value={DEFAULT_REVIEW_HORIZON} onChange={() => {}} />);
    for (const horizon of REVIEW_HORIZONS) {
      expect(screen.getByRole("radio", { name: horizon.label })).toBeInTheDocument();
    }
    expect(screen.getByRole("radio", { name: "2 weeks" })).toBeChecked();
  });

  it("reports the horizon the user picks", async () => {
    const onChange = vi.fn();
    render(<ReviewHorizonPicker value={DEFAULT_REVIEW_HORIZON} onChange={onChange} />);
    await userEvent.click(screen.getByRole("radio", { name: "3 months" }));
    expect(onChange).toHaveBeenCalledWith("3m");
  });

  it("does not promise a notification it cannot send", () => {
    render(<ReviewHorizonPicker value={DEFAULT_REVIEW_HORIZON} onChange={() => {}} />);
    const text = document.body.textContent ?? "";
    expect(text).not.toMatch(/email|notify|notification|remind you/i);
  });
});
