import { useEffect, useState } from "react";

type TickerProps = {
  time: Date;
};

export function Ticker({ time }: TickerProps) {
  const [items, setItems] = useState(seedItems());
  useEffect(() => {
    const t = setInterval(() => {
      setItems((prev) =>
        prev.map((it) => ({
          ...it,
          value: it.drift
            ? (parseFloat(it.value) + (Math.random() - 0.5) * it.drift).toFixed(it.decimals ?? 2)
            : it.value,
        }))
      );
    }, 1400);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="relative border-y border-line bg-bg-soft/40">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-chronos/30 to-transparent" />
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-8 gap-y-3 px-6 py-4 lg:px-10">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-chronos opacity-40" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-chronos" />
          </span>
          <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-dim">
            Live cluster · {time.toISOString().slice(11, 19)} UTC
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-x-8 gap-y-2">
          {items.map((it) => (
            <div key={it.label} className="flex items-baseline gap-2">
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-faint">
                {it.label}
              </span>
              <span className="font-mono text-[13px] text-ink tabular-nums">
                {it.prefix}
                {it.value}
                {it.suffix}
              </span>
              {it.delta && <span className="font-mono text-[10px] text-chronos">{it.delta}</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

type Item = {
  label: string;
  value: string;
  prefix?: string;
  suffix?: string;
  drift?: number;
  decimals?: number;
  delta?: string;
};

function seedItems(): Item[] {
  return [
    { label: "Forks/s", value: "4.82", suffix: "M", drift: 0.05, decimals: 2, delta: "+12.4%" },
    { label: "Sim. depth", value: "10", suffix: "⁶" },
    { label: "Entropy", value: "0.021", drift: 0.003, decimals: 3 },
    { label: "Regions", value: "14" },
    { label: "Nodes", value: "3,428", delta: "+24" },
    { label: "Cold start", value: "1.2", suffix: "ms", delta: "-0.4ms" },
  ];
}
