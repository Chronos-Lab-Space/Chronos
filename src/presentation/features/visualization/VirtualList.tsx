import { useMemo, useState, type ReactNode, type UIEvent } from "react";

type VirtualListProps<T> = {
  items: readonly T[];
  height: number;
  rowHeight: number;
  overscan?: number;
  getKey: (item: T, index: number) => string;
  renderRow: (item: T, index: number) => ReactNode;
  className?: string;
};

/**
 * Fixed-height list virtualization with zero external runtime dependencies.
 * Only visible items plus a small overscan window are mounted in the DOM.
 */
export function VirtualList<T>({
  items,
  height,
  rowHeight,
  overscan = 4,
  getKey,
  renderRow,
  className,
}: VirtualListProps<T>) {
  const [scrollTop, setScrollTop] = useState(0);
  const visible = useMemo(() => {
    const start = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
    const count = Math.ceil(height / rowHeight) + overscan * 2;
    return { start, end: Math.min(items.length, start + count) };
  }, [height, items.length, overscan, rowHeight, scrollTop]);

  const onScroll = (event: UIEvent<HTMLDivElement>) => {
    setScrollTop(event.currentTarget.scrollTop);
  };

  return (
    <div
      className={className}
      data-testid="virtual-list"
      onScroll={onScroll}
      style={{ height, overflowY: "auto", contain: "strict" }}
    >
      <div style={{ height: items.length * rowHeight, position: "relative" }}>
        {items.slice(visible.start, visible.end).map((item, offset) => {
          const index = visible.start + offset;
          return (
            <div
              key={getKey(item, index)}
              data-testid="virtual-row"
              style={{
                position: "absolute",
                top: index * rowHeight,
                left: 0,
                right: 0,
                height: rowHeight,
              }}
            >
              {renderRow(item, index)}
            </div>
          );
        })}
      </div>
    </div>
  );
}
