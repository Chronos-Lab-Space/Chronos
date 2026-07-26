import { useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import { CommandPalette } from './CommandPalette'
import { ContextPanel } from './ContextPanel'
import { Header } from './Header'
import { Sidebar } from './Sidebar'
import { StepperBand } from './StepperBand'
import { useWorkspace } from './workspace-context'

export function WorkspaceShell() {
  const { paletteOpen, setPaletteOpen, setNavOpen, setContextOpen } = useWorkspace()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPaletteOpen(!paletteOpen)
      } else if (e.key === 'Escape') {
        setPaletteOpen(false)
        setNavOpen(false)
        setContextOpen(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [paletteOpen, setPaletteOpen, setNavOpen, setContextOpen])

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-void text-paper">
      <Header />

      <div className="flex min-h-0 flex-1">
        <Sidebar />

        <main className="flex min-w-0 flex-1 flex-col">
          <StepperBand />

          <div className="flex min-h-0 flex-1">
            <div className="min-w-0 flex-1 overflow-y-auto">
              <Outlet />
            </div>
            <ContextPanel />
          </div>
        </main>
      </div>

      {paletteOpen && <CommandPalette />}
    </div>
  )
}
