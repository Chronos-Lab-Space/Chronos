import { ScrollReveal } from "./ScrollReveal";

export function Metrics() {
  return (
    <section className="relative py-24 lg:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-10">
        <ScrollReveal stagger variant="fade" className="grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-line bg-line md:grid-cols-2 lg:grid-cols-4">
          {metrics.map((m) => (
            <div
              key={m.label}
              className="group relative bg-bg p-8 transition hover:bg-bg-soft"
            >
              <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-faint">
                {m.label}
              </div>
              <div className="mt-6 flex items-baseline gap-2">
                <div className="font-serif text-6xl leading-none tracking-tight text-ink md:text-7xl">
                  {m.value}
                </div>
                {m.unit && (
                  <div className="font-mono text-sm text-ink-dim">{m.unit}</div>
                )}
              </div>
              <div className="mt-4 flex items-center gap-2 text-[12px] text-ink-dim">
                <span className={m.delta.startsWith("+") ? "text-emerald-400" : "text-chronos"}>
                  {m.delta}
                </span>
                <span className="text-ink-faint">vs. 2024 baseline</span>
              </div>

              {/* tiny chart */}
              <svg viewBox="0 0 100 24" className="mt-6 h-6 w-full">
                <polyline
                  points={m.spark}
                  fill="none"
                  stroke={m.color}
                  strokeWidth="1.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <polyline
                  points={m.spark}
                  fill="none"
                  stroke={m.color}
                  strokeWidth="4"
                  opacity="0.15"
                />
              </svg>
            </div>
          ))}
        </ScrollReveal>
      </div>
    </section>
  );
}

const metrics = [
  {
    label: "Simulated years, daily",
    value: "47",
    unit: "y / day",
    delta: "+312%",
    color: "#c6f0ff",
    spark: "0,20 10,16 20,14 30,10 40,12 50,6 60,8 70,4 80,6 90,2 100,3",
  },
  {
    label: "End-to-end latency (p99)",
    value: "0.31",
    unit: "ms",
    delta: "-82%",
    color: "#b79bff",
    spark: "0,6 10,10 20,8 30,14 40,12 50,16 60,14 70,18 80,16 90,20 100,22",
  },
  {
    label: "Cluster uptime",
    value: "99.999",
    unit: "%",
    delta: "+0.004%",
    color: "#ffd7a3",
    spark: "0,18 10,18 20,18 30,18 40,18 50,18 60,18 70,18 80,18 90,18 100,18",
  },
  {
    label: "Active temporal agents",
    value: "2.4M",
    unit: "",
    delta: "+48%",
    color: "#c6f0ff",
    spark: "0,20 10,18 20,16 30,14 40,10 50,12 60,8 70,6 80,4 90,4 100,2",
  },
];
