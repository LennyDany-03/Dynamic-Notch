import { useEffect, useRef } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { cardSize } from '../layout'
import type { NotchModule, NotchState } from '../types/notch'

const isTauri = () => !!(window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__

/**
 * Drives the native window from the state machine.
 *
 * Mica is a whole-window backdrop, so the window has to *be* the card — drawing a
 * small card inside a large transparent canvas would paint a Mica rectangle
 * across the desktop around it. The window is therefore resized on every state
 * and module change, and hidden outright when the notch is hidden.
 *
 * Returns a token that increments whenever the window geometry changes, so the
 * cursor hit-test can re-read the window rect instead of using a stale one.
 */
export function useNotchWindow(state: NotchState, activeModule: NotchModule) {
  const geometryToken = useRef(0)
  const { width, height } = cardSize(state, activeModule)
  const visible = state !== 'hidden'

  useEffect(() => {
    if (!isTauri()) return
    let cancelled = false

    const sync = async () => {
      try {
        if (!visible) {
          await invoke('set_notch_visible', { visible: false })
          return
        }
        // Size before showing, so the window never appears at the wrong size.
        await invoke('resize_notch', { width, height })
        if (cancelled) return
        await invoke('set_notch_visible', { visible: true })
      } catch (err) {
        console.error('notch window: sync failed', err)
      } finally {
        if (!cancelled) geometryToken.current += 1
      }
    }

    sync()
    return () => {
      cancelled = true
    }
  }, [visible, width, height])

  return geometryToken
}
