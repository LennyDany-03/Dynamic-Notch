import { useCallback, useEffect, useRef, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { useHotzone } from './useHotzone'
import { contentRect } from '../layout'
import { timing } from '../tokens'
import { MODULES, STATE_RANK, type NotchModule, type NotchState } from '../types/notch'

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
 * `alwaysVisible` moves the *floor* of that machine from `hidden` to `peek`: the
 * pill stays on screen instead of collapsing away, and dwell still expands it.
 * Everything above the floor is unchanged, which is why this is a floor and not a
 * separate mode — one branch on where the machine may come to rest, rather than a
 * second set of transitions to keep in step with the first.
 *
 * `activeModule` is intentionally separate from `state`: switching modules resizes
 * the card without retriggering the expand animation.
 */
export function useNotchState({ alwaysVisible = false }: { alwaysVisible?: boolean } = {}) {
  const [state, setState] = useState<NotchState>('hidden')
  const [activeModule, setActiveModule] = useState<NotchModule>('media')

  /** The lowest state the notch may come to rest in. */
  const resting: NotchState = alwaysVisible ? 'peek' : 'hidden'

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

    if (state === resting || graceRef.current || pinnedRef.current) return

    graceRef.current = setTimeout(() => {
      graceRef.current = null
      // One level at a time. This effect re-runs on the new state and, if the
      // cursor is still away, schedules the next step down — until it reaches the
      // floor, where the guard above stops scheduling.
      setState((current) => (current === 'expanded' ? 'peek' : resting))
    }, timing.graceMs)
    // `resting` is a dependency so that switching the preference off re-runs this
    // and lets a pill that was resting on screen collapse on the normal schedule.
  }, [inside, state, resting])

  // Switching the preference on should put the pill up straight away rather than
  // wait for the next hover. The opposite direction needs nothing: the effect
  // above re-runs on the new floor and steps the pill down for us.
  useEffect(() => {
    if (alwaysVisible) setState((current) => (current === 'hidden' ? 'peek' : current))
  }, [alwaysVisible])

  // Timers must not outlive the hook.
  useEffect(() => {
    return () => {
      clearDwell()
      clearGrace()
    }
  }, [])

  /**
   * Re-assert the overlay's z-order every time it grows.
   *
   * The window is created always-on-top, but it never takes focus, so anything
   * else that goes topmost afterwards — a fullscreen video, another overlay —
   * lands above it and stays there. Growing is the cheapest moment that matters:
   * it costs one call per reach, not one per module switch, and it runs just
   * before the card is actually looked at.
   *
   * Keyed on the rank rather than on leaving `hidden`, because with the pill
   * resting on screen the notch leaves `hidden` exactly once — at startup — and a
   * band lost hours later would never be reclaimed. Every peek → expanded counts.
   *
   * Rust decides what "raise" means, by reading the always-on-top preference:
   * this is a request to *match* the setting, not to rise. There is deliberately
   * no matching call on the way down — the window's band tracks the preference at
   * all times, so there is nothing to undo. Rejects harmlessly in the browser
   * fallback.
   */
  const lastRankRef = useRef(STATE_RANK.hidden)
  useEffect(() => {
    if (STATE_RANK[state] > lastRankRef.current) void invoke('notch_raise').catch(() => {})
    lastRankRef.current = STATE_RANK[state]
  }, [state])

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
