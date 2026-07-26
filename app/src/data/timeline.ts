export interface TimelineEntry {
  date: string
  state: string
  /** The most recent entry is the decision's current state. */
  current: boolean
  headline: string
  body: string
}

export const TIMELINE: TimelineEntry[] = [
  {
    date: '24 JUL',
    state: 'EVALUATING · CURRENT',
    current: true,
    headline: '31 futures ranked, recommendation issued',
    body: 'Confidence moved 58% → 72% after the closed-beta survey landed. Community-first path leads by 8 points.',
  },
  {
    date: '21 JUL',
    state: 'SIMULATING',
    current: false,
    headline: 'First run — 12 futures',
    body: 'Future #18 collapsed and removed: assumed a partner announcement that was never confirmed.',
  },
  {
    date: '19 JUL',
    state: 'DRAFT',
    current: false,
    headline: 'Roadmap and market research imported',
    body: '9 sources attached. Constraints written: 90-day window, $5k/mo ceiling, privacy review, no core regressions.',
  },
  {
    date: '18 JUL',
    state: 'DRAFT · OPENED',
    current: false,
    headline: 'Decision opened by Julien',
    body: 'Objective: a public beta that earns durable adoption.',
  },
]
