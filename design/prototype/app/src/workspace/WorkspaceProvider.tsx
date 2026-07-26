import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import type { FutureKey } from '../data/futures'
import { DECISION_STATES, DEFAULT_STEP } from './decision-states'
import { WorkspaceContext, type ContextTab, type WorkspaceValue } from './workspace-context'

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  const [step, setStepState] = useState(DEFAULT_STEP)
  const [selected, setSelected] = useState<FutureKey>('a')
  const [tab, setTab] = useState<ContextTab>('details')
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [navOpen, setNavOpen] = useState(false)
  const [contextOpen, setContextOpen] = useState(false)

  const dismiss = useCallback(() => {
    setPaletteOpen(false)
    setNavOpen(false)
    setContextOpen(false)
  }, [])

  const go = useCallback(
    (path: string) => {
      navigate(path)
      dismiss()
    },
    [navigate, dismiss],
  )

  const setStep = useCallback(
    (next: number) => {
      setStepState(next)
      dismiss()
    },
    [dismiss],
  )

  const selectFuture = useCallback(
    (key: FutureKey) => {
      setSelected(key)
      go('/simulation')
    },
    [go],
  )

  const value = useMemo<WorkspaceValue>(
    () => ({
      step,
      stateLabel: DECISION_STATES[step].name,
      setStep,
      selected,
      selectFuture,
      tab,
      setTab,
      paletteOpen,
      setPaletteOpen,
      navOpen,
      setNavOpen,
      contextOpen,
      setContextOpen,
      go,
    }),
    [step, setStep, selected, selectFuture, tab, paletteOpen, navOpen, contextOpen, go],
  )

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>
}
