export const MEMORY_STATS = [
  { label: 'CALIBRATION', value: '81%', caption: 'predictions within range', accent: true },
  { label: 'OVERCONFIDENCE', value: '+6 pts', caption: 'avg, on growth forecasts', accent: false },
  { label: 'PRIORS ACTIVE', value: '6', caption: 'applied to this decision', accent: false },
]

export interface MemoryEntry {
  title: string
  band: string
  /** Whether the outcome landed inside the predicted band. */
  hit: boolean
  lead: string
  learned: string
  footnote?: { text: string; accent: boolean }
}

export const MEMORY: MemoryEntry[] = [
  {
    title: 'Pricing change — annual-first',
    band: 'PREDICTED 68% · ACTUAL 71%',
    hit: true,
    lead: 'Closed 04 Jun. Outcome landed inside the predicted band.',
    learned:
      'existing users tolerate price restructuring when the migration is opt-in — this prior now boosts staged rollouts by 4 points.',
    footnote: { text: 'APPLIED TO THIS DECISION', accent: false },
  },
  {
    title: 'Docs relaunch — big-bang release',
    band: 'PREDICTED 74% · ACTUAL 49%',
    hit: false,
    lead: 'Closed 22 May. Missed badly — support load was modelled at a third of reality.',
    learned:
      'simultaneous launches understate support cost; Chronos now penalises them by 11 points.',
    footnote: { text: 'THIS IS WHY THE INFLUENCER PATH RANKS SECOND', accent: true },
  },
  {
    title: 'Community program — Discord first',
    band: 'PREDICTED 55% · ACTUAL 63%',
    hit: true,
    lead: 'Closed 12 Apr. Beat the forecast.',
    learned:
      'the community cohort reports bugs 3× faster than public traffic and churns less when it feels early.',
    footnote: { text: 'APPLIED TO THIS DECISION', accent: false },
  },
  {
    title: 'Hiring — contract-to-hire designers',
    band: 'PREDICTED 61% · ACTUAL 58%',
    hit: false,
    lead: 'Closed 30 Mar. Within range.',
    learned: 'nothing new — the prior held, so its weight was left untouched.',
  },
]
