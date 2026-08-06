import { useCallback, useEffect, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'

export interface ClipboardEntry {
  id: string
  text: string
  kind: 'text' | 'link'
  copiedAt: number
}

const POLL_MS = 1000

const isTauri = () => !!(window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__

/**
 * Clipboard history, captured by a Rust-side poller.
 *
 * Read here on a timer only while the panel is open — the capture itself runs
 * independently in the backend, so nothing is missed while this is idle.
 */
export function useClipboardHistory(active: boolean) {
  const [entries, setEntries] = useState<ClipboardEntry[]>([])
  const [loaded, setLoaded] = useState(false)

  const refresh = useCallback(async () => {
    if (!isTauri()) {
      setLoaded(true)
      return
    }
    try {
      setEntries(await invoke<ClipboardEntry[]>('get_clipboard_history'))
    } catch (err) {
      console.error('clipboard: read failed', err)
    } finally {
      setLoaded(true)
    }
  }, [])

  useEffect(() => {
    if (!active) return
    refresh()
    const id = setInterval(refresh, POLL_MS)
    return () => clearInterval(id)
  }, [active, refresh])

  const copy = useCallback(
    async (entry: ClipboardEntry) => {
      if (!isTauri()) return
      try {
        await invoke('copy_to_clipboard', { text: entry.text })
        refresh()
      } catch (err) {
        console.error('clipboard: copy failed', err)
      }
    },
    [refresh],
  )

  const clear = useCallback(async () => {
    if (!isTauri()) return
    try {
      await invoke('clear_clipboard_history')
      setEntries([])
    } catch (err) {
      console.error('clipboard: clear failed', err)
    }
  }, [])

  return { entries, loaded, copy, clear }
}

/** Compact age label — "now", "2m", "3h", "5d". */
export function relativeTime(ms: number): string {
  const seconds = Math.max(0, Math.floor((Date.now() - ms) / 1000))
  if (seconds < 45) return 'now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${Math.max(1, minutes)}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`
  return `${Math.floor(hours / 24)}d`
}
