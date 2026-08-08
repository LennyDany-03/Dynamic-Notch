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
 * Polling never stops, but it slows down while nothing is drawn: the overlay
 * announces a track that has just started (see `useMediaAnnounce`), and it can
 * only notice that if it is still watching the session while hidden. `visible`
 * therefore picks the *rate*, not whether to poll at all.
 *
 * Between polls the position is interpolated locally, which keeps the scrub bar
 * moving smoothly at 1 poll/sec instead of visibly stepping; that only runs while
 * visible, since nothing is on screen to interpolate for otherwise.
 *
 * The interpolation is on top of a `progressMs` that `media.rs` has already
 * brought up to date — Windows' `Position` is a snapshot taken whenever the
 * player last pushed a timeline update, so the two halves solve different
 * problems. Removing either one stops the bar: without Rust's the poll re-anchors
 * to the same stale number every second, without this one it steps once a second.
 */

/** While the notch is on screen and a scrub bar is moving. */
const POLL_MS = 1000
/** While nothing is drawn — only fast enough to catch a track starting. */
const WATCH_MS = 2000
const INTERPOLATE_MS = 250

const isTauri = () => !!(window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__

export function useMediaSession(visible: boolean) {
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

  // Re-polling on the way in as well as on the interval means an opening card
  // never shows state up to a watch interval old.
  useEffect(() => {
    poll()
    const id = setInterval(poll, visible ? POLL_MS : WATCH_MS)
    return () => clearInterval(id)
  }, [visible, poll])

  // Re-render between polls so the interpolated position advances.
  useEffect(() => {
    if (!visible || !media?.isPlaying) return
    const id = setInterval(() => tick((n) => n + 1), INTERPOLATE_MS)
    return () => clearInterval(id)
  }, [visible, media?.isPlaying])

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
