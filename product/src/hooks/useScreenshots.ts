import { useCallback, useEffect, useRef, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import type { Screenshot } from '../types/screenshots'

/**
 * Watches the folders Windows saves screenshots to: reports a capture the moment
 * it lands, so the notch can announce it, and keeps the standing list, so the
 * screenshots card can show it.
 *
 * The same shape as `useWindowsNotifications`, deliberately, because it is the same
 * problem — one poll answering both "what just happened" and "what is there" — and
 * two hooks that agreed on the answer but disagreed on how they reached it would
 * be two things to keep in step. The rules that carry over:
 *
 *  - **The first poll is a baseline and announces nothing.** Otherwise launching
 *    Crest announces whatever screenshot the user last took, possibly days ago.
 *    The *list* has no such baseline and is populated from that very first poll —
 *    the backlog is precisely what the card is for.
 *  - **One banner per batch.** A poll can find several at once (a burst of
 *    captures, or a folder that has just come back online after OneDrive synced
 *    it), and the newest is the one the user was looking at.
 *  - **The poll runs whether or not the notch is on screen**, because with nothing
 *    on screen is exactly when the banner earns its keep.
 *
 * What is different is that this hook does not persist a "seen" set: `list_screenshots`
 * is a directory listing rather than a queue being drained, so the seen set is
 * pruned to what the last poll actually found and cannot grow for the life of the
 * process.
 */

/** Matches the notification poll. Fast enough that a banner still feels caused. */
const POLL_MS = 2000

/**
 * How recently a capture must have been written for its arrival to be announced.
 *
 * The unseen-path test alone is not enough, and the case it gets wrong is
 * ordinary: the list is capped at 24, so **deleting one promotes the
 * twenty-fifth**, which is a path the previous poll did not have and is not new at
 * all. Without this the notch would announce a screenshot from last week because
 * the user tidied up a folder. The same test covers a folder that appears mid-poll
 * (OneDrive finishing a sync, an external drive coming back), which would otherwise
 * announce whatever the newest thing in it happened to be.
 *
 * A minute rather than a few seconds, because the poll can be a good deal later
 * than the capture: the machine sleeps, the webview is throttled, OneDrive writes
 * the file before it finishes flushing it.
 */
const FRESH_MS = 60_000

const isTauri = () => !!(window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__

export interface ScreenshotFeed {
  /** The newest captures, newest first. Capped by Rust — see `MAX_SHOTS`. */
  shots: Screenshot[]
  /** False until the first poll settles. An empty list before that means "not yet". */
  loaded: boolean
  /** Open one in whatever Windows opens pictures with. */
  open: (shot: Screenshot) => void
  /** Start a real shell drag, so the file can be dropped into another app. */
  startDrag: (shot: Screenshot) => void
  /** Open Explorer with the file selected. */
  reveal: (shot: Screenshot) => void
}

export function useScreenshots(
  enabled: boolean,
  onCapture: (shot: Screenshot) => void,
): ScreenshotFeed {
  // Held in a ref so a caller re-creating the callback each render does not tear
  // down and restart the poll — which would re-baseline and swallow a capture.
  const onCaptureRef = useRef(onCapture)
  onCaptureRef.current = onCapture

  const [shots, setShots] = useState<Screenshot[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (!enabled || !isTauri()) {
      // Switching the preference off empties the list rather than freezing the
      // last poll on screen: the notch has stopped watching, and a stale grid
      // would keep claiming otherwise.
      setShots([])
      setLoaded(false)
      return
    }

    let cancelled = false
    let seen: Set<string> | null = null

    const poll = async () => {
      let current: Screenshot[]
      try {
        current = await invoke<Screenshot[]>('list_screenshots')
      } catch {
        // No screenshot folders on this machine, or none readable. Nothing to
        // report and nothing to be done about it from here; the card says so.
        return
      }
      if (cancelled) return

      setShots(current)
      setLoaded(true)

      const paths = new Set(current.map((shot) => shot.path))

      if (seen === null) {
        seen = paths
        return
      }

      // Rust already sorted newest-first, so the first unseen entry is the newest
      // one — there is nothing to compare timestamps for here beyond `FRESH_MS`,
      // which is about whether it is an *arrival* rather than about which one.
      const now = Date.now()
      const arrived = current.find(
        (shot) => !seen!.has(shot.path) && now - shot.capturedAt < FRESH_MS,
      )
      seen = paths
      if (arrived) onCaptureRef.current(arrived)
    }

    void poll()
    const interval = setInterval(() => void poll(), POLL_MS)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [enabled])

  const open = useCallback((shot: Screenshot) => {
    if (!isTauri()) return
    // `launch_app` is the shell's open verb by any other name, and it is what the
    // file shelf already opens with. A second command that did the same thing
    // would be a second place for "open a path" to be subtly different.
    void invoke('launch_app', { path: shot.path }).catch((err) =>
      console.error('screenshots: open failed', err),
    )
  }, [])

  const reveal = useCallback((shot: Screenshot) => {
    if (!isTauri()) return
    void invoke('reveal_screenshot', { path: shot.path }).catch((err) =>
      console.error('screenshots: reveal failed', err),
    )
  }, [])

  const startDrag = useCallback((shot: Screenshot) => {
    if (!isTauri()) return
    // The same handshake the file shelf performs: the shell owns the mouse for the
    // length of the drag, and `useHotzone` has to be told to keep the window
    // interactive throughout or the cursor poll flips it to click-through the
    // instant the pointer crosses the card's edge — which is one pixel in.
    window.dispatchEvent(new CustomEvent<boolean>('native-file-drag', { detail: true }))
    void invoke('start_file_drag', { path: shot.path }).catch((err) => {
      console.error('screenshots: could not start file drag', err)
      window.dispatchEvent(new CustomEvent<boolean>('native-file-drag', { detail: false }))
    })
  }, [])

  // The end of the drag. Emitted by `shelf.rs` once `SHDoDragDrop` returns, which
  // is the only thing that knows the modal loop has finished.
  useEffect(() => {
    if (!isTauri()) return
    let unlisten: (() => void) | undefined
    let cancelled = false

    listen('file-drag-ended', () => {
      window.dispatchEvent(new CustomEvent<boolean>('native-file-drag', { detail: false }))
    })
      .then((fn) => {
        if (cancelled) fn()
        else unlisten = fn
      })
      .catch(() => {})

    return () => {
      cancelled = true
      unlisten?.()
    }
  }, [])

  return { shots, loaded, open, startDrag, reveal }
}

/**
 * A capture's thumbnail, as a PNG data URI.
 *
 * Its own hook, and its own cache, for the reason `useNotificationLogo` has one:
 * the list is re-fetched every couple of seconds and the tiles are remounted
 * whenever the card is opened, so without this a grid of eight would be eight
 * shell round trips per poll for pictures that have not changed. Keyed by path —
 * a screenshot's contents cannot change, only its name can be reused after a
 * delete, which is rare enough to be worth the stale thumbnail it would cost.
 *
 * The cache is module-level so it survives the card being closed, which is most of
 * the time: reopening the notch redraws a grid that is already resolved rather
 * than fading eight tiles in again.
 */
const thumbnails = new Map<string, string | null>()

export function useScreenshotThumb(path: string | null): string | null {
  const [uri, setUri] = useState<string | null>(() => (path ? (thumbnails.get(path) ?? null) : null))

  useEffect(() => {
    if (!path || !isTauri()) return

    const cached = thumbnails.get(path)
    if (cached !== undefined) {
      setUri(cached)
      return
    }

    let cancelled = false
    void invoke<string | null>('screenshot_thumbnail', { path })
      .then((resolved) => {
        // Cached either way, `null` included. A file the shell cannot render is a
        // permanent answer, and retrying it on every poll would be a shell call
        // every two seconds for a tile that is never going to have a picture.
        thumbnails.set(path, resolved ?? null)
        if (!cancelled) setUri(resolved ?? null)
      })
      .catch(() => {
        if (!cancelled) setUri(null)
      })

    return () => {
      cancelled = true
    }
  }, [path])

  return uri
}
