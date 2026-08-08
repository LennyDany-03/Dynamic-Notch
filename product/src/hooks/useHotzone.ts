import { useEffect, useRef, useState } from 'react'
import { listen } from '@tauri-apps/api/event'
import { cursorPosition, getCurrentWindow, primaryMonitor } from '@tauri-apps/api/window'
import { hotzone } from '../tokens'
import { rectContains, type Rect } from '../types/notch'

/**
 * Cursor tracking for the overlay.
 *
 * The window is click-through (`setIgnoreCursorEvents(true)`) whenever the cursor
 * is not over actual content, so the desktop underneath stays usable. While
 * click-through is on, the webview receives no DOM mouse events at all — which is
 * why position has to be polled from the OS rather than read off `mousemove`.
 *
 * Reports two booleans:
 *  - `inHotzone`: cursor is in the top-center trigger strip at the screen edge.
 *  - `inContent`: cursor is inside the currently rendered content bounds.
 *
 * Content bounds are passed as a getter (not a value) so that changing them does
 * not tear down and restart the poll loop. The getter is handed the point being
 * tested, because the bounds are allowed to depend on where the cursor is — see
 * the latch in `useNotchState`, which refuses to shrink a rect out from under it.
 */

const POLL_MS = 16
/** Monitor geometry and window origin change rarely; re-read them on this cadence. */
const GEOMETRY_REFRESH_MS = 2000

const isTauri = () => !!(window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__

interface Geometry {
  /** Device pixel ratio of the monitor. */
  scale: number
  /** Window origin in physical pixels. */
  originX: number
  originY: number
}

export function useHotzone(getContentRect: (x: number, y: number) => Rect | null) {
  const [inHotzone, setInHotzone] = useState(false)
  const [inContent, setInContent] = useState(false)

  const getContentRectRef = useRef(getContentRect)
  getContentRectRef.current = getContentRect

  // Only push a click-through change when it actually flips, to avoid a stream of
  // redundant IPC calls at 60Hz.
  const lastIgnoreRef = useRef<boolean | null>(null)
  const nativeFileDragRef = useRef(false)

  useEffect(() => {
    let cancelled = false

    const setIgnoreEvents = (ignore: boolean) => {
      if (!isTauri() || lastIgnoreRef.current === ignore) return
      lastIgnoreRef.current = ignore
      getCurrentWindow()
        .setIgnoreCursorEvents(ignore)
        .catch(() => {})
    }

    // A shell file drag continues outside this tiny overlay window. Keep this
    // window interactive for the full native drag; otherwise the cursor poller
    // switches it to click-through as soon as the cursor crosses the card edge.
    const onNativeFileDrag = (event: Event) => {
      nativeFileDragRef.current = (event as CustomEvent<boolean>).detail
      if (nativeFileDragRef.current) setIgnoreEvents(false)
    }
    window.addEventListener('native-file-drag', onNativeFileDrag)

    /** Hit-test a point already converted to window-local CSS pixels. */
    const evaluate = (localX: number, localY: number, windowWidth: number) => {
      const centerX = windowWidth / 2
      const hot =
        localY >= 0 &&
        localY <= hotzone.height &&
        localX >= centerX - hotzone.width / 2 &&
        localX <= centerX + hotzone.width / 2

      const contentRect = getContentRectRef.current(localX, localY)
      const content = contentRect ? rectContains(contentRect, localX, localY) : false

      setInHotzone(hot)
      setInContent(content)

      // Accept clicks only while the cursor is genuinely over content.
      if (!nativeFileDragRef.current) setIgnoreEvents(!content)
    }

    // ── Browser fallback ──────────────────────────────────────────────────────
    // Lets the whole state machine be exercised with `npm run dev` in a plain
    // browser, where the viewport stands in for the screen.
    if (!isTauri()) {
      const onMove = (e: MouseEvent) => evaluate(e.clientX, e.clientY, window.innerWidth)
      const onLeave = () => {
        setInHotzone(false)
        setInContent(false)
      }
      window.addEventListener('mousemove', onMove)
      document.addEventListener('mouseleave', onLeave)
      return () => {
        window.removeEventListener('mousemove', onMove)
        document.removeEventListener('mouseleave', onLeave)
        window.removeEventListener('native-file-drag', onNativeFileDrag)
      }
    }

    // ── Tauri path ────────────────────────────────────────────────────────────
    let geometry: Geometry | null = null
    let lastGeometryRead = 0

    const readGeometry = async (): Promise<Geometry | null> => {
      try {
        const [monitor, position] = await Promise.all([
          primaryMonitor(),
          getCurrentWindow().outerPosition(),
        ])
        if (!monitor) return null
        return {
          scale: monitor.scaleFactor || 1,
          originX: position.x,
          originY: position.y,
        }
      } catch {
        return null
      }
    }

    const tick = async () => {
      const now = Date.now()
      if (!geometry || now - lastGeometryRead > GEOMETRY_REFRESH_MS) {
        const next = await readGeometry()
        if (cancelled) return
        if (next) {
          geometry = next
          lastGeometryRead = now
        }
      }
      if (!geometry) return

      try {
        const pos = await cursorPosition()
        if (cancelled) return
        // Physical screen pixels → window-local CSS pixels.
        const localX = (pos.x - geometry.originX) / geometry.scale
        const localY = (pos.y - geometry.originY) / geometry.scale
        evaluate(localX, localY, window.innerWidth)
      } catch {
        // Cursor can be unreadable transiently (e.g. during a session lock).
        // Skip the frame rather than thrashing state.
      }
    }

    // The window origin is cached, and the position preference moves the window
    // out from under that cache: every cursor position would be converted against
    // the old origin until the next scheduled refresh, i.e. the notch would open
    // from where it used to be for up to two seconds after the setting changed.
    //
    // Invalidated twice because `set_position` is queued onto the window thread
    // and can still be in flight when Rust broadcasts — the first pass catches the
    // common case, the second one catches a move that had not landed yet. Both are
    // a single extra geometry read, and only on a preference change.
    const invalidate = () => {
      lastGeometryRead = 0
    }
    let settled: ReturnType<typeof setTimeout> | null = null
    const pendingUnlisten = listen('settings-changed', () => {
      invalidate()
      if (settled) clearTimeout(settled)
      settled = setTimeout(invalidate, 250)
    })

    // Start click-through so the transparent window never blocks the desktop.
    setIgnoreEvents(true)

    const interval = setInterval(tick, POLL_MS)
    return () => {
      cancelled = true
      clearInterval(interval)
      if (settled) clearTimeout(settled)
      void pendingUnlisten.then((unlisten) => unlisten())
      window.removeEventListener('native-file-drag', onNativeFileDrag)
    }
  }, [])

  return { inHotzone, inContent }
}
