export interface KnowledgeRow {
  name: string
  source: string
  age: string
  cited: string
  /** Sources the simulations leaned on most are called out in the accent. */
  leaned: boolean
}

export const KNOWLEDGE: KnowledgeRow[] = [
  { name: 'Product Roadmap Q3', source: 'Notion', age: '1d ago', cited: 'CITED 24×', leaned: true },
  {
    name: 'Market research — dev tooling 2025',
    source: 'PDF',
    age: '2d ago',
    cited: 'CITED 19×',
    leaned: true,
  },
  {
    name: 'Closed-beta survey results',
    source: 'Dataset',
    age: '4d ago',
    cited: 'CITED 17×',
    leaned: true,
  },
  {
    name: 'Community feedback thread',
    source: 'Discord',
    age: '3d ago',
    cited: 'CITED 11×',
    leaned: false,
  },
  {
    name: 'Competitor launch teardowns',
    source: 'Document',
    age: '2d ago',
    cited: 'CITED 8×',
    leaned: false,
  },
  {
    name: 'Infra cost model (Q3 forecast)',
    source: 'Spreadsheet',
    age: '6d ago',
    cited: 'CITED 7×',
    leaned: false,
  },
  {
    name: 'Support ticket volumes, closed beta',
    source: 'Dataset',
    age: '8d ago',
    cited: 'CITED 5×',
    leaned: false,
  },
  {
    name: 'Privacy review checklist',
    source: 'Document',
    age: '11d ago',
    cited: 'CITED 3×',
    leaned: false,
  },
  {
    name: 'Press list & embargo notes',
    source: 'Notes',
    age: '14d ago',
    cited: 'CITED 1×',
    leaned: false,
  },
]
