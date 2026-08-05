import NotchShell from './components/NotchShell'
import { useNotchState } from './hooks/useNotchState'
import { useMediaSession } from './hooks/useMediaSession'

export default function App() {
  const { state, activeModule, nextModule, previousModule } = useNotchState()

  // One poll shared by the collapsed pill and the media card. Stops entirely
  // while hidden, so an idle notch costs nothing.
  const session = useMediaSession(state !== 'hidden')

  return (
    <NotchShell
      state={state}
      activeModule={activeModule}
      onPreviousModule={previousModule}
      onNextModule={nextModule}
      session={session}
    />
  )
}
