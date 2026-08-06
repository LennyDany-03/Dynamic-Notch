import { useCallback, useEffect, useRef, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import type { MediaInfo } from '../types/media'

/**
 * Now-playing state from `GlobalSystemMediaTransportControlsSessionManager`.
 *
 * That one WinRT API already aggregates every app that registers a transport
 * session — Spotify, browser tabs, native players — so there are no per-app
 * integrations here.
 *
 * Polling only runs while `active`, so a hidden notch costs nothing. Between
 * polls the position is interpolated locally, which keeps the scrub bar moving
 * smoothly at 1 poll/sec instead of visibly stepping.
 */

const POLL_MS = 1000
const INTERPOLATE_MS = 250

const isTauri = () => !!(window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__

export function useMediaSession(active: boolean) {
  const [media, setMedia] = useState<MediaInfo | null>(null)
  const [loaded, setLoaded] = useState(false)

  // Position at the moment of the last poll, plus when that poll landed.
  const baseRef = useRef({ progressMs: 0, at: 0 })
  const [, tick] = useState(0)

  const poll = useCallback(async () => {
    if (!isTauri()) {
      setLoaded(true)
      return
    }
    try {
      const info = await invoke<MediaInfo>('get_current_media')
      setMedia(info)
      baseRef.current = { progressMs: info.progressMs, at: Date.now() }
    } catch {
      // "No active media session" is the normal idle case, not an error worth
      // surfacing — nothing is playing.
      setMedia(null)
    } finally {
      setLoaded(true)
    }
  }, [])

  useEffect(() => {
    if (!active) return
    poll()
    const id = setInterval(poll, POLL_MS)
    return () => clearInterval(id)
  }, [active, poll])

  // Re-render between polls so the interpolated position advances.
  useEffect(() => {
    if (!active || !media?.isPlaying) return
    const id = setInterval(() => tick((n) => n + 1), INTERPOLATE_MS)
    return () => clearInterval(id)
  }, [active, media?.isPlaying])

  const progressMs = (() => {
    if (!media) return 0
    if (!media.isPlaying) return media.progressMs
    const elapsed = Date.now() - baseRef.current.at
    return Math.min(baseRef.current.progressMs + elapsed, media.durationMs || Infinity)
  })()

  const run = useCallback(
    async (command: string, args?: Record<string, unknown>) => {
      if (!isTauri()) return
      try {
        await invoke(command, args)
      } catch (err) {
        console.error(`media: ${command} failed`, err)
      }
      // Re-poll immediately so the UI reflects the new state without waiting out
      // the interval.
      poll()
    },
    [poll],
  )

  const playPause = useCallback(() => run('media_play_pause'), [run])
  const next = useCallback(() => run('media_next'), [run])
  const previous = useCallback(() => run('media_prev'), [run])
  const seek = useCallback(
    (positionMs: number) => {
      // Move the bar right away; the poll will confirm.
      baseRef.current = { progressMs: positionMs, at: Date.now() }
      tick((n) => n + 1)
      return run('media_seek', { positionMs: Math.round(positionMs) })
    },
    [run],
  )

  return { media, progressMs, loaded, playPause, next, previous, seek }
}

/** Shared session object, owned by App and passed to the pill and the media card. */
export type MediaSession = ReturnType<typeof useMediaSession>
