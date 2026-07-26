export const DECISION = {
  title: 'Launch Chronos Public Beta',
  objective:
    'Find the path to a public beta that earns durable adoption — enough signal to learn from, few enough promises to keep.',
  meta: [
    { label: 'Created', value: '18 Jul 2025' },
    { label: 'Owner', value: 'Julien' },
    { label: 'Window', value: 'closes 12 Aug' },
    { label: 'Visibility', value: 'Private' },
  ],
  recommendation: {
    badge: 'FUTURE 07 · 72% · HIGH CONFIDENCE',
    headline:
      'Open the beta on 12 Aug to the community list first, Product Hunt seven days later.',
    body: 'Across 31 simulated futures, a staged opening beat every simultaneous launch. The community cohort absorbs the first wave of bugs while support load is still cheap, and the Product Hunt spike lands on a build that has already been corrected once. Cost stays inside the $5k/mo ceiling in 28 of 31 runs.',
  },
  confidence: {
    value: '72%',
    caption: 'High · rising since 21 Jul',
    stats: [
      { label: 'EVIDENCE', value: '9', caption: 'sources cited' },
      { label: 'SIMULATIONS', value: '31', caption: 'futures explored' },
      { label: 'AGREEMENT', value: '87%', caption: 'across models' },
      { label: 'CONSTRAINTS', value: '4 / 4', caption: 'satisfied' },
      { label: 'DISSENT', value: '3', caption: 'runs breach cost' },
      { label: 'STALENESS', value: '2d', caption: 'since last input' },
    ],
  },
}

export interface EvidenceRow {
  name: string
  kind: string
  age: string
  weight: 'HIGH' | 'MEDIUM'
}

export const EVIDENCE: EvidenceRow[] = [
  { name: 'Product Roadmap Q3', kind: 'Document · Notion', age: '1d ago', weight: 'HIGH' },
  { name: 'Market research — dev tooling 2025', kind: 'Report · PDF', age: '2d ago', weight: 'HIGH' },
  { name: 'Competitor launch teardowns', kind: 'Document', age: '2d ago', weight: 'MEDIUM' },
  {
    name: 'Community feedback thread (412 replies)',
    kind: 'Notes · Discord',
    age: '3d ago',
    weight: 'MEDIUM',
  },
  { name: 'Closed-beta survey results', kind: 'Dataset', age: '4d ago', weight: 'HIGH' },
]
