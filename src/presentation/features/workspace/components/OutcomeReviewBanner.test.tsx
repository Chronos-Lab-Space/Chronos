import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import type { ReviewItem } from "../../../../domain/workspace/outcomeReview";
import { OutcomeReviewBanner } from "./OutcomeReviewBanner";

function item(partial: Partial<ReviewItem> = {}): ReviewItem {
  return {
    simulationId: "sim-1",
    decisionTitle: "Should we raise or extend runway?",
    chosenPathName: "Focused launch",
    reviewAt: "2026-08-01T12:00:00.000Z",
    daysOverdue: 5,
    href: "/workspace/simulations/sim-1#outcome",
    ...partial,
  };
}

function renderBanner(items: readonly ReviewItem[]) {
  return render(
    <MemoryRouter>
      <OutcomeReviewBanner items={items} />
    </MemoryRouter>
  );
}

describe("OutcomeReviewBanner", () => {
  it("renders nothing when nothing is due — an empty queue is not news", () => {
    const { container } = renderBanner([]);
    expect(container).toBeEmptyDOMElement();
  });

  it("links each due decision to its outcome panel", () => {
    renderBanner([item()]);
    const link = screen.getByRole("link", { name: /log outcome/i });
    expect(link).toHaveAttribute("href", "/workspace/simulations/sim-1#outcome");
  });

  it("names the decision and the path that was taken", () => {
    renderBanner([item()]);
    expect(screen.getByText(/Should we raise or extend runway\?/)).toBeInTheDocument();
    expect(screen.getByText(/Focused launch/)).toBeInTheDocument();
  });

  it("says due today rather than 0 days ago", () => {
    renderBanner([item({ daysOverdue: 0 })]);
    expect(screen.getByText(/due today/i)).toBeInTheDocument();
  });

  it("uses the singular for one day", () => {
    renderBanner([item({ daysOverdue: 1 })]);
    expect(screen.getByText(/due 1 day ago/i)).toBeInTheDocument();
  });

  it("lists every due decision", () => {
    renderBanner([
      item(),
      item({
        simulationId: "sim-2",
        href: "/workspace/simulations/sim-2#outcome",
        decisionTitle: "Hire or contract?",
      }),
    ]);
    expect(screen.getAllByRole("link", { name: /log outcome/i })).toHaveLength(2);
  });
});
