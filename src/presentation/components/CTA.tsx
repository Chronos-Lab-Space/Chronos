import { Link } from "react-router-dom";

export function CTA() {
  return (
    <section className="relative py-24 lg:py-32">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-1/2 h-[500px] w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#1C3E4E] opacity-35 blur-[120px]" />
      </div>
      <div className="relative mx-auto max-w-2xl px-6 lg:px-10">
        <div className="mb-8 flex items-center justify-center gap-3">
          <div className="h-px w-8 bg-chronos/60" />
          <span className="font-mono text-[11px] uppercase tracking-[0.25em] text-chronos">
            Public beta · open
          </span>
          <div className="h-px w-8 bg-chronos/60" />
        </div>
        <h2 className="font-serif text-center text-[clamp(2rem,5.5vw,4.5rem)] leading-[0.98] tracking-tight">
          Build the future
          <br />
          <span className="gradient-text italic">before you ship it.</span>
        </h2>
        <p className="mx-auto mt-8 max-w-xl text-center text-[15px] leading-[1.75] text-ink-dim">
          Join the public beta and open a Decision Workspace — simulate futures, rank trade-offs,
          and keep the path in memory.
        </p>
        <Link
          to="/workspace"
          className="group mx-auto mt-10 inline-flex items-center gap-3 rounded-full bg-ink px-7 py-4 text-sm font-medium text-bg transition hover:bg-chronos"
        >
          Join public beta
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            className="transition group-hover:translate-x-0.5"
          >
            <path
              d="M2 7h10M8 3l4 4-4 4"
              stroke="currentColor"
              strokeWidth="1.5"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </Link>
      </div>
    </section>
  );
}
