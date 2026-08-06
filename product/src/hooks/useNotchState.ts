import { useCallback, useEffect, useRef, useState } from 'react'
import { useHotzone } from './useHotzone'
import { contentRect } from '../layout'
import { timing } from '../tokens'
import { MODULES, type NotchModule, type NotchState } from '../types/notch'

/**
 * The notch visibility state machine — the single source of truth for whether the
 * overlay is hidden, peeking, or expanded. Components subscribe to this; none of
 * them decide their own visibility.
 *
 *   hidden ──cursor enters hotzone (no delay)──▶ peek
 *   peek   ──800ms continuous dwell───────────▶ expanded
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

  const getContentRect = useCallback(
    () => contentRect(stateRef.current, moduleRef.current, window.innerWidth),
    [],
  )

  const { inHotzone, inContent } = useHotzone(getContentRect)
  const inside = inHotzone || inContent

  const dwellRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const graceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  /**
   * Set when something other than the cursor opened the notch — today, the tray
   * popup. Without it the card would open under a cursor that is down by the
   * taskbar, count as "outside", and collapse again within the grace window.
   *
   * Released as soon as the cursor arrives (the user has taken over) or the
   * window loses focus (they moved on), after which the normal rules resume.
   */
  const pinnedRef = useRef(false)

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
      pinnedRef.current = false

      if (state === 'hidden') {
        setState('peek')
        return
      }

      if (state === 'peek') {
        // Guarded so a re-render mid-dwell does not restart the countdown.
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

    if (state === 'hidden' || graceRef.current || pinnedRef.current) return

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

  // Clicking away is the user moving on, so a pinned card should give up its hold
  // and collapse on the normal schedule.
  useEffect(() => {
    const release = () => {
      pinnedRef.current = false
    }
    window.addEventListener('blur', release)
    return () => window.removeEventListener('blur', release)
  }, [])

  const showModule = useCallback((module: NotchModule, options?: { pin?: boolean }) => {
    // Selecting a module is an explicit intent to stay open, so it beats a step
    // down that the poll loop may already have armed in the preceding frame.
    clearGrace()
    clearDwell()
    if (options?.pin) pinnedRef.current = true
    setActiveModule(module)
    setState('expanded')
  }, [])

  /** Open at whatever module is already selected. Used by the tray's "Show notch". */
  const expand = useCallback((options?: { pin?: boolean }) => {
    showModule(moduleRef.current, options)
  }, [showModule])

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

  return { state, activeModule, showModule, expand, nextModule, previousModule }
}
