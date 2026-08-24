import { useCallback, useEffect, useRef, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { IDLE_TIMER, phaseOf, remainingMs, type TimerState } from '../types/timer'

/**
 * The countdown timer: the stored state, the clock that runs it down, and the
 * moment it lands.
 *
 * `useReminders` is the pattern for the refs (a caller that rebuilds its callback
 * each render must not restart the tick, and the tick has to read the latest
 * state without making it a dependency) and for the `localStorage` fallback that
 * keeps the whole thing working in `npm run dev`.
 *
 * Three things here are not in `useReminders`, and each is the timer being a
 * different kind of thing from a list of reminders:
 *
 *  - **It listens for `timer-changed`.** Every notch window mounts this hook, and
 *    with `notchAllDisplays` on there is one per screen. Rust broadcasts on every
 *    write (see `timer.rs`), so a timer started on one monitor is the same timer
 *    on the next one rather than a second, private one.
 *  - **It ticks only while running.** Idle and paused set no interval at all,
 *    which matters in an overlay running for the life of the session: the common
 *    case for this hook is nine hours of nothing.
 *  - **Only the lead window owns the landing.** `onDone`, the write that clears
 *    the finished timer, and the chime behind it all run once rather than once
 *    per screen — the same rule and the same reasoning as `useAutoUpdate`. Every
 *    window still *draws* the finished state, because drawing is what mirroring
 *    is for.
 */

/**
 * How often the clock is read while a timer runs.
 *
 * One second, unlike the reminder tick's twenty, and for the obvious reason: the
 * card's entire content is a number of seconds. It is still the *minimum* honest
 * rate rather than a compromise — nothing here needs sub-second sampling, because
 * the progress trace and the pill ring interpolate in CSS between ticks
 * (`transition: stroke-dashoffset 1s linear`), so a one-second tick produces a
 * continuously gliding sweep rather than a stepping one.
 */
const TICK_MS = 1000

const STORAGE_KEY = 'dynamic-notch-timer'

const isTauri = () => !!(window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__

export interface TimerFeed {
  timer: TimerState
  /** False until the first read settles. Distinguishes "idle" from "not yet". */
  loaded: boolean
  /**
   * `now`, sampled by this hook's own tick.
   *
   * Handed out rather than left for each surface to call `Date.now()` itself, so
   * the card, the trace and the pill chip agree to the millisecond. Two readers
   * each taking their own clock disagree by however long React took between them,
   * which at a second boundary is a chip reading 0:01 beside a card reading 0:00.
   */
  now: number
  start: (durationMs: number) => void
  pause: () => void
  resume: () => void
  reset: () => void
}

async function persist(next: TimerState) {
  try {
    if (isTauri()) await invoke('write_timer', { timer: next })
    else localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch (err) {
    console.error('timer: save failed', err)
  }
}

export function useTimer(
  /**
   * Whether this window speaks for the app — `isLeadNotch` in `App`.
   *
   * Gates the *landing* only: the write that clears a finished timer, and the
   * `onDone` call that carries the banner and the chime. Without it three
   * monitors would race the same write and play three chimes a beat apart.
   */
  lead: boolean,
  onDone: (durationMs: number, landedAt: number) => void,
): TimerFeed {
  const [timer, setTimer] = useState<TimerState>(IDLE_TIMER)
  const [loaded, setLoaded] = useState(false)
  const [now, setNow] = useState(() => Date.now())

  const onDoneRef = useRef(onDone)
  onDoneRef.current = onDone
  const leadRef = useRef(lead)
  leadRef.current = lead
  const timerRef = useRef<TimerState>(IDLE_TIMER)
  timerRef.current = timer

  // First read, and the broadcast that keeps every notch window in step.
  useEffect(() => {
    let cancelled = false

    const load = async () => {
      let stored = IDLE_TIMER
      try {
        if (isTauri()) {
          stored = (await invoke<TimerState>('read_timer')) ?? IDLE_TIMER
        } else {
          const raw = localStorage.getItem(STORAGE_KEY)
          if (raw) stored = { ...IDLE_TIMER, ...JSON.parse(raw) }
        }
      } catch (err) {
        console.error('timer: load failed', err)
      }
      if (cancelled) return

      setTimer(stored)
      setLoaded(true)
    }

    void load()

    const pending = listen<TimerState>('timer-changed', (event) => {
      // Adopted wholesale rather than merged. The writer is always some window's
      // copy of this same hook, so the payload is already the complete state, and
      // a merge would let a stale local field survive a reset.
      setTimer({ ...IDLE_TIMER, ...event.payload })
    })

    return () => {
      cancelled = true
      void pending.then((unlisten) => unlisten()).catch(() => {})
    }
  }, [])

  /** Apply a change, store it, and keep the ref in step for the tick. */
  const commit = useCallback((next: TimerState) => {
    timerRef.current = next
    setTimer(next)
    void persist(next)
  }, [])

  const start = useCallback(
    (durationMs: number) => {
      if (durationMs <= 0) return
      commit({ durationMs, endsAt: Date.now() + durationMs, pausedRemainingMs: null })
    },
    [commit],
  )

  const pause = useCallback(() => {
    const current = timerRef.current
    if (current.endsAt === null) return
    // The remaining is computed once, here, and stored. This is the only place a
    // duration is written instead of an instant, and this is why: a paused timer
    // has no instant to store, because the instant it lands on is not decided
    // until it resumes.
    commit({
      ...current,
      endsAt: null,
      pausedRemainingMs: Math.max(0, current.endsAt - Date.now()),
    })
  }, [commit])

  const resume = useCallback(() => {
    const current = timerRef.current
    if (current.pausedRemainingMs === null) return
    commit({
      ...current,
      endsAt: Date.now() + current.pausedRemainingMs,
      pausedRemainingMs: null,
    })
  }, [commit])

  const reset = useCallback(() => {
    // `durationMs` survives, so the card comes back to rest showing what it was
    // set for rather than blank — reset means "put it back", not "forget it".
    commit({ ...timerRef.current, endsAt: null, pausedRemainingMs: null })
  }, [commit])

  // The clock. Runs only while something is actually counting down.
  const running = phaseOf(timer) === 'running'

  useEffect(() => {
    if (!running) return

    const tick = () => {
      const stamp = Date.now()
      setNow(stamp)

      const current = timerRef.current
      if (current.endsAt === null || remainingMs(current, stamp) > 0) return

      // Landed.
      //
      // Every window reaches this line, and every window is about to draw the
      // finished state — but only one may act on it. A mirrored set racing the
      // same write would have three copies of this hook clearing the same file
      // and three chimes a beat apart.
      if (!leadRef.current) return

      const { durationMs, endsAt } = current
      // Back to idle, keeping the duration: the card comes to rest showing what
      // just ran, with Start under the cursor.
      commit({ durationMs, endsAt: null, pausedRemainingMs: null })
      onDoneRef.current(durationMs, endsAt)
    }

    // Straight away as well as on the interval, so a timer that came due while
    // Crest was closed lands on the first frame after the file is read rather
    // than a second later.
    tick()
    const id = setInterval(tick, TICK_MS)
    return () => clearInterval(id)
  }, [running, commit])

  return { timer, loaded, now, start, pause, resume, reset }
}
