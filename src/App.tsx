import { useCallback } from 'react'
import NotchShell from './components/NotchShell'
import { useNotchState } from './hooks/useNotchState'
import { useMediaSession } from './hooks/useMediaSession'
import { useFileShelf } from './hooks/useFileShelf'

export default function App() {
  const { state, activeModule, showModule, nextModule, previousModule } = useNotchState()

  // One poll shared by the collapsed pill and the media card. Stops entirely
  // while hidden, so an idle notch costs nothing.
  const session = useMediaSession(state !== 'hidden')

  // A drag reaching the notch is an unambiguous request for the shelf, so it
  // skips the dwell timer and opens straight to it.
  const revealShelf = useCallback(() => showModule('files'), [showModule])
  const shelf = useFileShelf(revealShelf)

  return (
    <NotchShell
      state={state}
      activeModule={activeModule}
      onPreviousModule={previousModule}
      onNextModule={nextModule}
      session={session}
      shelf={shelf}
    />
  )
}
