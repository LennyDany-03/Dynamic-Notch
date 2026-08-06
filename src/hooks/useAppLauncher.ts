import { useCallback, useEffect, useMemo, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import Fuse from 'fuse.js'

export interface AppEntry {
  name: string
  path: string
}

const MAX_PINNED = 4
const MAX_RESULTS = 6

const isTauri = () => !!(window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__

/**
 * Start Menu index plus fuzzy search.
 *
 * The index is scanned once on mount and held in memory — it is a few hundred
 * entries and only changes when something is installed, so re-scanning per
 * keystroke would be wasted work.
 */
export function useAppLauncher(active: boolean) {
  const [apps, setApps] = useState<AppEntry[]>([])
  const [pinnedPaths, setPinnedPaths] = useState<string[]>([])
  const [query, setQuery] = useState('')
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

  const fuse = useMemo(
    () =>
      new Fuse(apps, {
        keys: ['name'],
        threshold: 0.4,
        ignoreLocation: true,
      }),
    [apps],
  )

  const results = useMemo(() => {
    const trimmed = query.trim()
    if (!trimmed) return []
    return fuse
      .search(trimmed, { limit: MAX_RESULTS })
      .map((r) => r.item)
  }, [fuse, query])

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
    results,
    query,
    setQuery,
    loaded,
    launch,
    togglePin,
    maxPinned: MAX_PINNED,
  }
}
