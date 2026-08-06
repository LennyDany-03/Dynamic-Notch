import { useEffect, useRef, useState } from 'react'
import { cursorPosition, getCurrentWindow, primaryMonitor } from '@tauri-apps/api/window'
import { hotzone } from '../tokens'

/**
 * Cursor tracking for the overlay.
 *
 * Everything here works in **physical screen pixels**. The window is resized to
 * whatever card is showing and hidden entirely when idle, so window-local
 * coordinates are not a stable frame of reference — the hotzone in particular has
 * to be detectable while the window is hidden and has no position at all.
 *
 * The window is click-through whenever the cursor is off content, so the webview
 * receives no DOM mouse events; position has to be polled from the OS.
 *
 * Reports:
 *  - `inHotzone`: cursor is in the top-centre trigger strip at the screen edge.
 *  - `inContent`: cursor is inside the notch window itself.
 */

const POLL_MS = 16
/** Monitor geometry rarely changes; the window rect changes on every resize. */
const MONITOR_REFRESH_MS = 2000
const WINDOW_REFRESH_MS = 200

const isTauri = () => !!(window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__

interface WindowRect {
  x: number
  y: number
  width: number
  height: number
}

export function useHotzone(hasContent: () => boolean, geometryToken: { current: number }) {
  const [inHotzone, setInHotzone] = useState(false)
  const [inContent, setInContent] = useState(false)

  const hasContentRef = useRef(hasContent)
  hasContentRef.current = hasContent

  const lastIgnoreRef = useRef<boolean | null>(null)

  useEffect(() => {
    let cancelled = false

    const setIgnoreEvents = (ignore: boolean) => {
      if (!isTauri() || lastIgnoreRef.current === ignore) return
      lastIgnoreRef.current = ignore
      getCurrentWindow()
        .setIgnoreCursorEvents(ignore)
        .catch(() => {})
    }

    // ── Browser fallback ──────────────────────────────────────────────────────
    if (!isTauri()) {
      const onMove = (e: MouseEvent) => {
        const centerX = window.innerWidth / 2
        setInHotzone(
          e.clientY >= 0 &&
            e.clientY <= hotzone.height &&
            Math.abs(e.clientX - centerX) <= hotzone.width / 2,
        )
        setInContent(hasContentRef.current() && e.clientY < window.innerHeight)
      }
      const onLeave = () => {
        setInHotzone(false)
        setInContent(false)
      }
      window.addEventListener('mousemove', onMove)
      document.addEventListener('mouseleave', onLeave)
      return () => {
        window.removeEventListener('mousemove', onMove)
        document.removeEventListener('mouseleave', onLeave)
      }
    }

    // ── Tauri path ────────────────────────────────────────────────────────────
    let scale = 1
    let screenWidth = 0
    let monitorReadAt = 0

    let windowRect: WindowRect | null = null
    let windowReadAt = 0
    let lastToken = -1

    const readMonitor = async () => {
      try {
        const monitor = await primaryMonitor()
        if (!monitor) return
        scale = monitor.scaleFactor || 1
        screenWidth = monitor.size.width
      } catch {
        /* transient; keep the previous values */
      }
    }

    const readWindowRect = async () => {
      try {
        const win = getCurrentWindow()
        const [position, size] = await Promise.all([win.outerPosition(), win.outerSize()])
        windowRect = { x: position.x, y: position.y, width: size.width, height: size.height }
      } catch {
        windowRect = null
      }
    }

    const tick = async () => {
      const now = Date.now()

      if (now - monitorReadAt > MONITOR_REFRESH_MS || screenWidth === 0) {
        monitorReadAt = now
        await readMonitor()
        if (cancelled) return
      }

      // Re-read the window rect on a slow cadence, and immediately whenever the
      // window has just been resized.
      if (geometryToken.current !== lastToken || now - windowReadAt > WINDOW_REFRESH_MS) {
        lastToken = geometryToken.current
        windowReadAt = now
        await readWindowRect()
        if (cancelled) return
      }

      if (screenWidth === 0) return

      try {
        const pos = await cursorPosition()
        if (cancelled) return

        const centerX = screenWidth / 2
        const hot =
          pos.y >= 0 &&
          pos.y <= hotzone.height * scale &&
          Math.abs(pos.x - centerX) <= (hotzone.width / 2) * scale

        const content =
          hasContentRef.current() &&
          windowRect !== null &&
          pos.x >= windowRect.x &&
          pos.x <= windowRect.x + windowRect.width &&
          pos.y >= windowRect.y &&
          pos.y <= windowRect.y + windowRect.height

        setInHotzone(hot)
        setInContent(content)
        setIgnoreEvents(!content)
      } catch {
        // Cursor can be unreadable transiently (e.g. during a session lock).
      }
    }

    setIgnoreEvents(true)
    const interval = setInterval(tick, POLL_MS)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [geometryToken])

  return { inHotzone, inContent }
}
