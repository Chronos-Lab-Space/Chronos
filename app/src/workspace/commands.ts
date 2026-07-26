import type { WorkspaceValue } from './workspace-context'

export interface Command {
  kind: 'RUN' | 'GO' | 'NEW' | 'ASK'
  label: string
  hint: string
  run: () => void
}

export function buildCommands(ws: WorkspaceValue): Command[] {
  return [
    { kind: 'RUN', label: 'simulate launch', hint: 'Ranked futures', run: () => ws.go('/simulation') },
    { kind: 'GO', label: 'show memory', hint: 'Past outcomes', run: () => ws.go('/memory') },
    { kind: 'GO', label: 'show timeline', hint: 'Decision history', run: () => ws.go('/timeline') },
    { kind: 'GO', label: 'open knowledge', hint: '9 sources', run: () => ws.go('/knowledge') },
    { kind: 'GO', label: 'current decision', hint: 'Workspace', run: () => ws.go('/decision') },
    {
      kind: 'RUN',
      label: 'advance decision',
      hint: 'Evaluating → Collapsed',
      run: () => ws.setStep(3),
    },
    { kind: 'RUN', label: 'log outcome', hint: 'Move to Observed', run: () => ws.setStep(4) },
    { kind: 'NEW', label: 'new decision', hint: 'Blank draft', run: () => ws.setStep(0) },
    {
      kind: 'ASK',
      label: 'why is confidence only 72%?',
      hint: 'Ask Chronos',
      run: () => ws.go('/simulation'),
    },
  ]
}

export function filterCommands(commands: Command[], query: string): Command[] {
  const q = query.trim().toLowerCase()
  if (!q) return commands
  return commands.filter((c) => `${c.label} ${c.hint}`.toLowerCase().includes(q))
}
