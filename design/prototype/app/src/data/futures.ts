export type FutureKey = 'a' | 'b' | 'c' | 'd'

export interface Future {
  key: FutureKey
  /** Rank in the "all branches" list. */
  rank: string
  pct: string
  recommended: boolean
  /** Short name used in the graph and the branch list. */
  shortLabel: string
  graphLabel: string
  /** Long name used in the ranked-futures list on the Decision screen. */
  listTitle: string
  listMeta: string
  verdict: string
  badge: string
  title: string
  body: string
  cost: string
  signups: string
  ret: string
  risk: string
}

export const FUTURES: Record<FutureKey, Future> = {
  a: {
    key: 'a',
    rank: '01',
    pct: '72%',
    recommended: true,
    shortLabel: 'Community → PH',
    graphLabel: 'COMMUNITY → PH',
    listTitle: 'Community list first, Product Hunt +7 days',
    listMeta: 'Cost $4.1k · Signups 1,240 · Retention 43%',
    verdict: 'RECOMMENDED',
    badge: 'FUTURE 07 · 72% · RECOMMENDED',
    title: 'Community list first, Product Hunt seven days later',
    body: 'The community cohort absorbs the first wave of bugs while support load is still cheap. By the time Product Hunt sends its spike, the build has already been corrected once. Cost stays inside the ceiling in 28 of 31 runs.',
    cost: '$4.1k',
    signups: '1,240',
    ret: '43%',
    risk: 'The community list underperforms and the PH spike hits an uncorrected build.',
  },
  b: {
    key: 'b',
    rank: '02',
    pct: '64%',
    recommended: false,
    shortLabel: 'Influencer-led',
    graphLabel: 'INFLUENCER',
    listTitle: 'Influencer-led rollout, single launch day',
    listMeta: 'Cost $6.8k · Signups 1,910 · Retention 29%',
    verdict: 'BREACHES COST',
    badge: 'FUTURE 12 · 64% · BREACHES COST',
    title: 'Influencer-led rollout on a single launch day',
    body: 'The largest top-of-funnel of any branch, and the worst retention. Support load peaks on day one against an untested build — the same shape that made the docs relaunch miss by 25 points.',
    cost: '$6.8k',
    signups: '1,910',
    ret: '29%',
    risk: 'Infra spend passes $5k/mo in 19 of 31 runs; churn compounds by week three.',
  },
  c: {
    key: 'c',
    rank: '03',
    pct: '51%',
    recommended: false,
    shortLabel: 'Stealth invites',
    graphLabel: 'STEALTH',
    listTitle: 'Stealth invite waves, no public moment',
    listMeta: 'Cost $2.2k · Signups 480 · Retention 61%',
    verdict: 'MISSES TARGET',
    badge: 'FUTURE 21 · 51% · MISSES TARGET',
    title: 'Stealth invite waves, no public moment',
    body: 'The safest and quietest path. Retention is the best of any branch because every user was hand-picked, but signups land less than half of target and the public narrative never arrives.',
    cost: '$2.2k',
    signups: '480',
    ret: '61%',
    risk: 'Never reaches 1,000 signups; the launch window closes without a public story.',
  },
  d: {
    key: 'd',
    rank: '04',
    pct: '38%',
    recommended: false,
    shortLabel: 'Delay to September',
    graphLabel: 'DELAY TO SEP',
    listTitle: 'Delay to September, ship onboarding first',
    listMeta: 'Cost $3.4k · Signups 890 · Retention 47%',
    verdict: 'WINDOW CLOSES',
    badge: 'FUTURE 29 · 38% · WINDOW CLOSES',
    title: 'Delay to September, ship onboarding first',
    body: 'Better product, worse timing. Onboarding lifts retention by six points, but the 90-day window expires and the competitive teardowns show two rivals shipping in the same weeks.',
    cost: '$3.4k',
    signups: '890',
    ret: '47%',
    risk: 'Breaches the 90-day constraint outright; rivals define the category first.',
  },
}

/** Ranked order, best first. */
export const RANKED_FUTURES: Future[] = [FUTURES.a, FUTURES.b, FUTURES.c, FUTURES.d]
