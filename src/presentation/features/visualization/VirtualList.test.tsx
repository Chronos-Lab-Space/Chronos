import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { VirtualList } from "./VirtualList";

describe("VirtualList", () => {
  it("mounts only a visible window and updates it after scrolling", () => {
    const items = Array.from({ length: 1_000 }, (_, id) => ({ id }));
    render(
      <VirtualList
        items={items}
        height={100}
        rowHeight={20}
        overscan={1}
        getKey={(item) => String(item.id)}
        renderRow={(item) => <span>branch-{item.id}</span>}
      />
    );

    expect(screen.getAllByTestId("virtual-row").length).toBeLessThan(20);
    expect(screen.getByText("branch-0")).toBeInTheDocument();
    expect(screen.queryByText("branch-999")).not.toBeInTheDocument();

    fireEvent.scroll(screen.getByTestId("virtual-list"), {
      target: { scrollTop: 19_000 },
    });

    expect(screen.getByText("branch-950")).toBeInTheDocument();
    expect(screen.queryByText("branch-0")).not.toBeInTheDocument();
  });
});
