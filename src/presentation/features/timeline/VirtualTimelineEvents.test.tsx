import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { LogEntry } from "../../../domain/chronos/types";
import { VirtualTimelineEvents } from "./VirtualTimelineEvents";

function makeEvents(count: number): LogEntry[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `e${i}`,
    phase: "evaluated" as const,
    message: `event-${i}`,
    color: "#60899B",
    timestamp: i,
  }));
}

describe("VirtualTimelineEvents", () => {
  it("shows the newest event first and mounts only a window", () => {
    render(<VirtualTimelineEvents events={makeEvents(400)} height={300} />);

    // newest-first: the last emitted event leads the list
    const rows = screen.getAllByTestId("virtual-row");
    expect(rows.length).toBeLessThan(30);
    expect(rows[0]).toHaveTextContent("event-399");
    expect(screen.queryByText("event-0")).not.toBeInTheDocument();
  });

  it("reaches the oldest event after scrolling to the bottom", () => {
    render(<VirtualTimelineEvents events={makeEvents(400)} height={300} />);

    fireEvent.scroll(screen.getByTestId("virtual-list"), {
      // 400 rows × 34px − 300px viewport
      target: { scrollTop: 400 * 34 - 300 },
    });

    expect(screen.getByText("event-0")).toBeInTheDocument();
    expect(screen.queryByText("event-399")).not.toBeInTheDocument();
  });

  it("renders every event when the set fits in the viewport", () => {
    render(<VirtualTimelineEvents events={makeEvents(3)} height={300} />);

    expect(screen.getByText("event-0")).toBeInTheDocument();
    expect(screen.getByText("event-1")).toBeInTheDocument();
    expect(screen.getByText("event-2")).toBeInTheDocument();
  });
});
