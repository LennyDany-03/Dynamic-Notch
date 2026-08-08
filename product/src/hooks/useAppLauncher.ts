import { useCallback, useEffect, useMemo, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'

export interface AppEntry {
  name: string
  path: string
}

const MAX_PINNED = 4

const isTauri = () => !!(window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__

/**
 * Start Menu index and the pinned set.
 *
 * The index is fetched once on mount and held in memory — it is a few hundred
 * entries and only changes when something is installed. `apps` is handed out
 * whole; the one place that searches it is `AppPicker`, which filters its own
 * copy, so there is no query state here.
 *
 * Rust answers from a cached index, so this normally resolves immediately rather
 * than waiting on a scan. When that cache is stale it re-scans in the background
 * and pushes the new list up through `apps-reindexed`.
 */
export function useAppLauncher(active: boolean) {
  const [apps, setApps] = useState<AppEntry[]>([])
  const [pinnedPaths, setPinnedPaths] = useState<string[]>([])
  const [loaded, setLoaded] = useState(false)
  // Scan lazily: nothing happens until the launcher is actually opened.
  useEffect(() => {
    if (!active) return

    let cancelled = false
    const load = async () => {
      if (!isTauri()) {
        setLoaded(true)
        return
      }
      try {
        const [list, pinned] = await Promise.all([
          invoke<AppEntry[]>('list_installed_apps'),
          invoke<string[]>('read_pinned'),
        ])
        if (cancelled) return
        setApps(list)
        setPinnedPaths(pinned)
      } catch (err) {
        console.error('launcher: scan failed', err)
      } finally {
        if (!cancelled) setLoaded(true)
      }
    }
    // React Strict Mode runs effects twice in development. Each setup needs to
    // start its own request: the first cleanup cancels its result, while the
    // second request is the one that must be allowed to populate the launcher.
    load()
    return () => {
      cancelled = true
    }
  }, [active])

  // A background re-scan found a different set of apps than the cached list this
  // opened with. Rare, and only fires when something was installed or removed.
  useEffect(() => {
    if (!isTauri()) return
    let unlisten: (() => void) | undefined
    let cancelled = false

    listen<AppEntry[]>('apps-reindexed', (event) => setApps(event.payload))
      .then((fn) => {
        if (cancelled) fn()
        else unlisten = fn
      })
      .catch((err) => console.error('launcher: could not watch re-index', err))

    return () => {
      cancelled = true
      unlisten?.()
    }
  }, [])

  const pinned = useMemo(() => {
    const byPath = new Map(apps.map((a) => [a.path, a]))
    return pinnedPaths
      .map((p) => byPath.get(p))
      .filter((a): a is AppEntry => a !== undefined)
      .slice(0, MAX_PINNED)
  }, [apps, pinnedPaths])

  const persistPinned = useCallback(async (paths: string[]) => {
    setPinnedPaths(paths)
    if (!isTauri()) return
    try {
      await invoke('write_pinned', { paths })
    } catch (err) {
      console.error('launcher: could not save pins', err)
    }
  }, [])

  const togglePin = useCallback(
    (app: AppEntry) => {
      const next = pinnedPaths.includes(app.path)
        ? pinnedPaths.filter((p) => p !== app.path)
        : [...pinnedPaths, app.path].slice(0, MAX_PINNED)
      persistPinned(next)
    },
    [pinnedPaths, persistPinned],
  )

  const launch = useCallback(async (app: AppEntry) => {
    if (!isTauri()) return
    try {
      await invoke('launch_app', { path: app.path })
    } catch (err) {
      console.error('launcher: launch failed', err)
    }
  }, [])

  return {
    apps,
    pinned,
    pinnedPaths,
    loaded,
    launch,
    togglePin,
    maxPinned: MAX_PINNED,
  }
}
