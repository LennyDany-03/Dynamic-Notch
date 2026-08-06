import { useCallback, useEffect } from 'react'
import { listen } from '@tauri-apps/api/event'
import NotchShell from './components/NotchShell'
import { useNotchState } from './hooks/useNotchState'
import { useMediaSession } from './hooks/useMediaSession'
import { useFileShelf } from './hooks/useFileShelf'
import { MODULES, type NotchModule } from './types/notch'

export default function App() {
  const { state, activeModule, showModule, expand, nextModule, previousModule } = useNotchState()

  // The tray popup can only ask; the state machine still owns what opens. Both
  // are pinned, because the cursor is down by the taskbar when they arrive.
  useEffect(() => {
    const pending = [
      listen('tray-show', () => expand({ pin: true })),
      listen<string>('tray-navigate', (event) => {
        const module = event.payload as NotchModule
        if (MODULES.includes(module)) showModule(module, { pin: true })
      }),
    ]
    return () => {
      for (const p of pending) void p.then((unlisten) => unlisten())
    }
  }, [expand, showModule])

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
