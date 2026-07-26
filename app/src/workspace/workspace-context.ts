import { createContext, useContext } from 'react'
import type { FutureKey } from '../data/futures'

export type ContextTab = 'details' | 'notes'

export interface WorkspaceValue {
  /** Index into DECISION_STATES. */
  step: number
  stateLabel: string
  setStep: (step: number) => void
  selected: FutureKey
  /** Selecting a future also takes you to the simulation screen. */
  selectFuture: (key: FutureKey) => void
  tab: ContextTab
  setTab: (tab: ContextTab) => void
  paletteOpen: boolean
  setPaletteOpen: (open: boolean) => void
  navOpen: boolean
  setNavOpen: (open: boolean) => void
  contextOpen: boolean
  setContextOpen: (open: boolean) => void
  /** Navigate and dismiss any open overlay. */
  go: (path: string) => void
}

export const WorkspaceContext = createContext<WorkspaceValue | null>(null)

export function useWorkspace(): WorkspaceValue {
  const value = useContext(WorkspaceContext)
  if (!value) throw new Error('useWorkspace must be used inside <WorkspaceProvider>')
  return value
}
