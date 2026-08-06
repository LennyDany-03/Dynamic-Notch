import { useCallback, useEffect, useRef, useState } from 'react'
import { useHotzone } from './useHotzone'
import { useNotchWindow } from './useNotchWindow'
import { timing } from '../tokens'
import { MODULES, type NotchModule, type NotchState } from '../types/notch'

/**
 * The notch visibility state machine — the single source of truth for whether the
 * overlay is hidden, peeking, or expanded. Components subscribe to this; none of
 * them decide their own visibility.
 *
 *   hidden ──cursor enters hotzone (no delay)──▶ peek
 *   peek   ──1.5s continuous dwell────────────▶ expanded
 *   peek   ──cursor leaves, 300ms grace───────▶ hidden
 *   expanded ──cursor leaves, 300ms grace─────▶ peek ──300ms grace──▶ hidden
 *
 * Leaving during the dwell clears the timer; re-entering during a grace window
 * cancels the step down. The step down from expanded runs one level at a time, so
 * the overlay collapses back through peek rather than vanishing.
 *
 * `activeModule` is intentionally separate from `state`: switching modules resizes
 * the card without retriggering the expand animation.
 */
export function useNotchState() {
  const [state, setState] = useState<NotchState>('hidden')
  const [activeModule, setActiveModule] = useState<NotchModule>('media')

  // Read by the poll loop, which must not restart when either value changes.
  const stateRef = useRef(state)
  stateRef.current = state
  const moduleRef = useRef(activeModule)
  moduleRef.current = activeModule

  // The native window is resized to match the card, so "over content" is simply
  // "over the window" — see useHotzone.
  const geometryToken = useNotchWindow(state, activeModule)
  const hasContent = useCallback(() => stateRef.current !== 'hidden', [])

  const { inHotzone, inContent } = useHotzone(hasContent, geometryToken)
  const inside = inHotzone || inContent

  const dwellRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const graceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearDwell = () => {
    if (dwellRef.current) {
      clearTimeout(dwellRef.current)
      dwellRef.current = null
    }
  }

  const clearGrace = () => {
    if (graceRef.current) {
      clearTimeout(graceRef.current)
      graceRef.current = null
    }
  }

  useEffect(() => {
    if (inside) {
      // Any pending step down is cancelled the moment the cursor comes back.
      clearGrace()

      if (state === 'hidden') {
        setState('peek')
        return
      }

      if (state === 'peek') {
        // Guarded so a re-render mid-dwell does not restart the 1.5s countdown.
        if (!dwellRef.current) {
          dwellRef.current = setTimeout(() => {
            dwellRef.current = null
            setState('expanded')
          }, timing.dwellMs)
        }
        return
      }

      clearDwell()
      return
    }

    // Cursor is out: dwell can never complete from here.
    clearDwell()

    if (state === 'hidden' || graceRef.current) return

    graceRef.current = setTimeout(() => {
      graceRef.current = null
      // One level at a time. This effect re-runs on the new state and, if the
      // cursor is still away, schedules the next step down.
      setState((current) => (current === 'expanded' ? 'peek' : 'hidden'))
    }, timing.graceMs)
  }, [inside, state])

  // Timers must not outlive the hook.
  useEffect(() => {
    return () => {
      clearDwell()
      clearGrace()
    }
  }, [])

  const showModule = useCallback((module: NotchModule) => {
    // Selecting a module is an explicit intent to stay open, so it beats a step
    // down that the poll loop may already have armed in the preceding frame.
    clearGrace()
    clearDwell()
    setActiveModule(module)
    setState('expanded')
  }, [])

  /** Step through the modules, wrapping at both ends. */
  const cycleModule = useCallback((direction: 1 | -1) => {
    clearGrace()
    clearDwell()
    setActiveModule((current) => {
      const index = MODULES.indexOf(current)
      return MODULES[(index + direction + MODULES.length) % MODULES.length]
    })
    setState('expanded')
  }, [])

  const nextModule = useCallback(() => cycleModule(1), [cycleModule])
  const previousModule = useCallback(() => cycleModule(-1), [cycleModule])

  return { state, activeModule, showModule, nextModule, previousModule }
}
