import { Link } from "react-router-dom";
import { confidencePercent } from "../../../../domain/workspace/seed";
import type { GoalRecord } from "../../../../domain/workspace/types";

type Props = { goal: GoalRecord; confidence: number | null };

export function GoalCard({ goal, confidence }: Props) {
  return (
    <section className="group rounded-2xl border border-line bg-bg-soft/20 p-5 sm:p-6 hover:border-chronos/40">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-faint">
          What am I working on?
        </div>
        <Link
          to="/workspace/simulations?new=1"
          className="font-mono text-[10px] uppercase tracking-[0.16em] text-chronos"
        >
          Generate futures →
        </Link>
      </div>
      <h1 className="mt-3 font-serif text-2xl text-ink sm:text-3xl">{goal.title}</h1>
      {goal.description ? (
        <p className="mt-2 text-sm text-ink-dim">{goal.description}</p>
      ) : null}
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <span className="rounded-full border border-line px-3 py-1.5 font-mono text-sm text-chronos">
          Confidence {confidencePercent(confidence)}
        </span>
        <span className="rounded-full border border-line px-2.5 py-1 font-mono text-[10px] uppercase text-ink-faint">
          {goal.status}
        </span>
      </div>
      <div className="mt-6 flex flex-wrap gap-2">
        <Link
          to="/workspace/simulations?new=1"
          className="rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-bg hover:bg-chronos"
        >
          Generate futures
        </Link>
        <Link
          to="/workspace/timeline"
          className="rounded-full border border-line px-4 py-2.5 text-sm text-ink-dim hover:text-chronos"
        >
          Open Timeline
        </Link>
      </div>
    </section>
  );
}
