/** The six states every Chronos decision advances through. Sublabels mirror the
 *  engine pipeline: define → branch → score & prune → collapse → log outcome →
 *  feeds memory & priors. */
export const DECISION_STATES = [
  { name: 'Draft', sub: 'Define objective · 18 Jul' },
  { name: 'Simulating', sub: 'Branch 31 futures · 21 Jul' },
  { name: 'Evaluating', sub: 'Score & prune · 24 Jul' },
  { name: 'Collapsed', sub: 'Commit to one path' },
  { name: 'Observed', sub: 'Log real outcome' },
  { name: 'Learned', sub: 'Feeds memory & priors' },
] as const

export const DEFAULT_STEP = 2
