import { useCallback, useEffect, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import type { DisplayInfo } from '../types/display'

/**
 * The screens currently attached, for the Display pane to draw.
 *
 * Not a preference and not stored — like `useNotificationAccess`, it is a fact
 * about the machine that can change while the window is open, and unlike that one
 * it changes without the user leaving the app: a docking station, a projector, a
 * laptop lid closed on an external monitor.
 *
 * Three things re-read it, and each covers a case the others do not:
 *
 *  - `displays-changed`, which Rust's monitor watcher emits when the set of
 *    screens actually moves. This is the one that matters — a pane showing a
 *    monitor that was unplugged two minutes ago is a picker offering a screen
 *    that is not there.
 *  - `settings-changed`, because `active` is not geometry. It says which screen
 *    the notch is on, which is exactly what the rows in this pane change.
 *  - `settings-opened`, because the window is hidden and reshown rather than
 *    rebuilt, so a mount is not an open (see `SettingsWindow`).
 */
export function useDisplays(): DisplayInfo[] {
  const [displays, setDisplays] = useState<DisplayInfo[]>([])

  const read = useCallback(() => {
    void invoke<DisplayInfo[]>('list_displays')
      .then(setDisplays)
      .catch(() => setDisplays([]))
  }, [])

  useEffect(() => read(), [read])

  useEffect(() => {
    const pending = [
      listen('displays-changed', read),
      listen('settings-changed', read),
      listen('settings-opened', read),
    ]
    return () => {
      for (const p of pending) void p.then((unlisten) => unlisten())
    }
  }, [read])

  return displays
}
