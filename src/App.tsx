import NotchShell from './components/NotchShell'
import { useNotchState } from './hooks/useNotchState'

export default function App() {
  const { state, activeModule, showModule } = useNotchState()

  return <NotchShell state={state} activeModule={activeModule} onSelectModule={showModule} />
}
