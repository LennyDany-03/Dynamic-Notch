import { useEffect, useRef, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'

/**
 * Check for an update on launch, and install it without asking.
 *
 * The tray popup's update row still exists and still works — it is the manual
 * path, and it reports a version number before spending it. This is the
 * automatic one: Crest checks shortly after it starts, and if there is something
 * newer it downloads and installs it silently. NSIS runs with `installMode:
 * "quiet"` (see `updater.rs`), so nothing of Windows' installer is ever on
 * screen; the only thing the user sees is the notch's own loader.
 *
 * **The app restarts itself when this completes.** That is the whole point of an
 * automatic update and it is also the reason for every delay below — an update
 * that yanked the app out from under someone mid-sentence would be worse than one
 * that waited.
 *
 * Three rules keep it out of the way:
 *
 *  - **It waits `STARTUP_DELAY_MS` before the first check.** Launch is the
 *    busiest moment on the machine, and Crest now starts *early* (see
 *    `autostart.rs`) — checking immediately would put a network request and a
 *    download in the middle of everything else waking up, which is the thing that
 *    made startup slow in the first place.
 *  - **It re-checks every `RECHECK_MS`.** The notch is a process that runs for
 *    weeks; "on launch" alone would mean a machine that never reboots never
 *    updates.
 *  - **It gives up quietly.** No network, a rate-limited endpoint, a release with
 *    no Windows asset — none of that is worth telling the user about, because
 *    none of it is anything they can act on. The tray row is where someone who
 *    wants to know goes.
 */

/** How long after mount before the first check. */
const STARTUP_DELAY_MS = 25_000

/** How often to look again on a long-running session. */
const RECHECK_MS = 6 * 60 * 60_000

const isTauri = () => !!(window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__

/** Mirrors `UpdateInfo` in `src-tauri/src/updater.rs`. */
interface UpdateInfo {
  version: string
  notes: string | null
}

/** Mirrors `Progress` in `src-tauri/src/updater.rs`. */
export interface UpdateProgress {
  downloaded: number
  /** Null when the server sent no content-length — the bar goes indeterminate. */
  total: number | null
  percent: number | null
}

/**
 * What the loader is showing.
 *
 * `installing` is the window between the last byte and the process being
 * replaced. It is usually under a second, but it is the one moment where nothing
 * is moving, and a bar frozen at 100% with no label reads as a hang.
 */
export type UpdatePhase = 'idle' | 'downloading' | 'installing'

export interface AutoUpdate {
  phase: UpdatePhase
  version: string | null
  progress: UpdateProgress | null
}

export function useAutoUpdate(enabled: boolean): AutoUpdate {
  const [phase, setPhase] = useState<UpdatePhase>('idle')
  const [version, setVersion] = useState<string | null>(null)
  const [progress, setProgress] = useState<UpdateProgress | null>(null)

  // Guards a second run against the same install. `updater_install` takes the
  // parked update, so a re-entrant call would fail with "no update pending" —
  // harmless, but it would also flip the loader back on after it had finished.
  const running = useRef(false)

  useEffect(() => {
    if (!isTauri() || !enabled) return

    const pending = listen<UpdateProgress>('updater-progress', (event) => {
      setProgress(event.payload)
      // The download has started, whatever the check said a moment ago.
      setPhase((current) => (current === 'idle' ? 'downloading' : current))
    })

    return () => {
      void pending.then((unlisten) => unlisten())
    }
  }, [enabled])

  useEffect(() => {
    if (!isTauri() || !enabled) return

    let cancelled = false

    const run = async () => {
      if (cancelled || running.current) return
      running.current = true

      try {
        const info = await invoke<UpdateInfo | null>('updater_check')
        if (cancelled || !info) return

        setVersion(info.version)
        setPhase('downloading')

        // Never resolves on success: the installer replaces this process. A
        // rejection is a real failure, and the loader goes away rather than
        // sitting at whatever percentage it reached.
        await invoke('updater_install')

        // Reached only if the installer handed control back without restarting,
        // which on Windows means it is about to.
        if (!cancelled) setPhase('installing')
      } catch {
        if (!cancelled) {
          setPhase('idle')
          setProgress(null)
          setVersion(null)
        }
      } finally {
        running.current = false
      }
    }

    const first = setTimeout(() => void run(), STARTUP_DELAY_MS)
    const repeat = setInterval(() => void run(), RECHECK_MS)

    return () => {
      cancelled = true
      clearTimeout(first)
      clearInterval(repeat)
    }
  }, [enabled])

  return { phase, version, progress }
}
