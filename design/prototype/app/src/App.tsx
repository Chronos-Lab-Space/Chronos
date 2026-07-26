import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { DecisionScreen } from './screens/DecisionScreen'
import { KnowledgeScreen } from './screens/KnowledgeScreen'
import { MemoryScreen } from './screens/MemoryScreen'
import { SimulationScreen } from './screens/SimulationScreen'
import { TimelineScreen } from './screens/TimelineScreen'
import { WorkspaceProvider } from './workspace/WorkspaceProvider'
import { WorkspaceShell } from './workspace/WorkspaceShell'

export function App() {
  return (
    <BrowserRouter>
      <WorkspaceProvider>
        <Routes>
          <Route element={<WorkspaceShell />}>
            <Route path="/decision" element={<DecisionScreen />} />
            <Route path="/knowledge" element={<KnowledgeScreen />} />
            <Route path="/simulation" element={<SimulationScreen />} />
            <Route path="/timeline" element={<TimelineScreen />} />
            <Route path="/memory" element={<MemoryScreen />} />
          </Route>
          <Route path="*" element={<Navigate to="/decision" replace />} />
        </Routes>
      </WorkspaceProvider>
    </BrowserRouter>
  )
}
