import { useCallback, useEffect, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'

/** Mirrors `Settings` in `src-tauri/src/settings.rs`. */
export interface Settings {
  alwaysOnTop: boolean
}

/**
 * Matches the Rust defaults. Spread over whatever comes back from disk so a field
 * added on the Rust side but missing from an old file still renders something,
 * and so the browser fallback (where `invoke` rejects) has a coherent state.
 */
const DEFAULTS: Settings = { alwaysOnTop: true }

/**
 * The settings window's state. Rust owns the file and the window flags; this only
 * mirrors them.
 *
 * Writes are optimistic — a switch has to move under the pointer — and reconcile
 * against the state Rust reports actually reaching, so a failed write snaps the
 * switch back instead of leaving it lying.
 */
export function useSettings() {
  const [settings, setSettings] = useState<Settings>(DEFAULTS)
  const [error, setError] = useState<string | null>(null)

  const read = useCallback(() => {
    void invoke<Settings>('read_settings')
      .then((stored) => setSettings({ ...DEFAULTS, ...stored }))
      .catch(() => setSettings(DEFAULTS))
  }, [])

  useEffect(() => read(), [read])

  // The window is hidden and reshown rather than rebuilt, so React never remounts.
  // Re-reading per open is what keeps it honest about changes made elsewhere.
  useEffect(() => {
    const pending = listen('settings-opened', () => {
      setError(null)
      read()
    })
    return () => {
      void pending.then((unlisten) => unlisten())
    }
  }, [read])

  const setAlwaysOnTop = useCallback((enabled: boolean) => {
    setSettings((prev) => ({ ...prev, alwaysOnTop: enabled }))
    setError(null)

    void invoke<boolean>('set_always_on_top', { enabled })
      .then((reached) => setSettings((prev) => ({ ...prev, alwaysOnTop: reached })))
      .catch(() => {
        setSettings((prev) => ({ ...prev, alwaysOnTop: !enabled }))
        setError("Couldn't save that setting.")
      })
  }, [])

  return { settings, error, setAlwaysOnTop }
}
