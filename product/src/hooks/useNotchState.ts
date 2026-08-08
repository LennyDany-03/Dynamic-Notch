import { useCallback, useEffect, useRef, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { useHotzone } from './useHotzone'
import { contentRect, type NotificationsFit } from '../layout'
import { timing } from '../tokens'
import {
  MODULES,
  STATE_RANK,
  rectContains,
  type Announcement,
  type NotchModule,
  type NotchState,
  type Rect,
} from '../types/notch'

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
 *   any resting state ──`announce()`───────────▶ announce ──2s──▶ resting
 *   announce ──600ms dwell────────────────────▶ expanded
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
 *
 * `announce` is the one way in that the user did not ask for: a banner dropped in
 * for a moment to report something (a track starting) and then taken away again.
 * It borrows the pin the tray uses and adds a timer, so it is still this machine
 * deciding what happens next — the cursor reaching the banner cancels the timer
 * and dwells through to a full card, exactly as it would on the pill.
 */
export function useNotchState({
  alwaysVisible = false,
  notificationsFit,
}: {
  alwaysVisible?: boolean
  /**
   * What the notifications card currently holds. The one card whose height is a
   * function of its contents, so the hit rect cannot be derived from the state and
   * the module alone — see `layout.notificationsCardHeight`.
   */
  notificationsFit?: NotificationsFit
} = {}) {
  const [state, setState] = useState<NotchState>('hidden')
  const [activeModule, setActiveModule] = useState<NotchModule>('media')

  /**
   * What the banner is reporting. Never cleared: the card fades out over a
   * frame or two after the state leaves `announce`, and blanking the content
   * would empty the banner before it has finished leaving.
   */
  const [announcement, setAnnouncement] = useState<Announcement | null>(null)

  /** The lowest state the notch may come to rest in. */
  const resting: NotchState = alwaysVisible ? 'peek' : 'hidden'

  // Read by the poll loop, which must not restart when either value changes.
  const stateRef = useRef(state)
  stateRef.current = state
  const moduleRef = useRef(activeModule)
  moduleRef.current = activeModule
  const fitRef = useRef(notificationsFit)
  fitRef.current = notificationsFit
  // Read by the banner's retract timer, which is armed before the preference it
  // has to respect can be known to have changed.
  const restingRef = useRef(resting)
  restingRef.current = resting

  /**
   * The rect the cursor poll hit-tests against: the card that is actually drawn,
   * held at its previous size for exactly as long as the cursor is inside it.
   *
   * The latch is what makes `layout.contentRect` able to return the real card.
   * The rule that has to hold is that a rect must never shrink out from under a
   * stationary cursor — switch from the launcher (400×346) to media (380×164)
   * with a click, and a rect that shrank on the spot would drop the cursor
   * outside and collapse the notch mid-click. That rule says nothing about the
   * rect being permanently the size of the biggest module, which is what it used
   * to be: it left a 182px band of bare desktop below the media card that kept
   * the notch open and swallowed clicks with nothing under the cursor.
   *
   * So: grow immediately, shrink only once the cursor has left the old bounds.
   * The notifications card leans on the same latch from the other direction: it
   * is sized to its list, so dismissing the last row shrinks it under a cursor
   * that is still over where the row was.
   */
  const heldRectRef = useRef<Rect | null>(null)
  const getContentRect = useCallback((x: number, y: number) => {
    const next = contentRect(
      stateRef.current,
      moduleRef.current,
      window.innerWidth,
      fitRef.current,
    )
    const held = heldRectRef.current

    // Nothing is drawn — there is no cursor position that should keep the window
    // interactive, so the hold goes with it.
    if (!next) {
      heldRectRef.current = null
      return null
    }

    // The cursor is in the old rect but would fall outside the new one. Keep the
    // old one; the very next tick that finds the cursor elsewhere adopts `next`.
    if (held && !rectContains(next, x, y) && rectContains(held, x, y)) return held

    heldRectRef.current = next
    return next
  }, [])

  const { inHotzone, inContent } = useHotzone(getContentRect)
  const inside = inHotzone || inContent

  // Read by `announce`, which must not put a banner on top of a cursor that is
  // already using the notch.
  const insideRef = useRef(inside)
  insideRef.current = inside
  // Read by the hover effect, which must not re-run merely because the banner's
  // contents changed.
  const announcementRef = useRef(announcement)
  announcementRef.current = announcement

  const dwellRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const graceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const announceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  /**
   * Set when something other than the cursor opened the notch — today, the tray
   * popup. Without it the card would open under a cursor that is down by the
   * taskbar, count as "outside", and collapse again within the grace window.
   *
   * Released as soon as the cursor arrives (the user has taken over), when the
   * window loses focus (they moved on), or when the lease runs out.
   *
   * The lease is not belt-and-braces, it is the only release that always fires.
   * The other two both need something to happen: the overlay takes focus only if
   * its card is clicked, so a window that was never focused never blurs, and a
   * card opened from the tray and then ignored was pinned *for the life of the
   * process* — expanded, topmost, and unreachable by the grace timer, because the
   * step-down is guarded on this flag. That is the "always on top is off and the
   * notch is still on screen" bug: `notch_settle` only runs when the notch
   * collapses, and it never collapsed.
   *
   * State rather than a ref alone, because the step-down effect is guarded on it:
   * releasing the pin has to re-run that effect, and a ref assignment renders
   * nothing. The ref mirrors it for the callbacks and timers that need the value
   * without waiting for a render, as everywhere else in this hook.
   */
  const [pinned, setPinned] = useState(false)
  const pinnedRef = useRef(pinned)
  pinnedRef.current = pinned
  const pinLeaseRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const unpin = useCallback(() => {
    if (pinLeaseRef.current) {
      clearTimeout(pinLeaseRef.current)
      pinLeaseRef.current = null
    }
    pinnedRef.current = false
    setPinned(false)
  }, [])

  const pin = useCallback(() => {
    if (pinLeaseRef.current) clearTimeout(pinLeaseRef.current)
    pinnedRef.current = true
    setPinned(true)
    pinLeaseRef.current = setTimeout(() => {
      pinLeaseRef.current = null
      pinnedRef.current = false
      // Nothing else changed, so this is what re-runs the step-down effect and
      // lets the ordinary grace window collapse a card nobody came for.
      setPinned(false)
    }, timing.pinMs)
  }, [])

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

  /**
   * Abandon a pending auto-retract. Called whenever the user takes the banner
   * over — hovering it, or picking a module — after which what is on screen is
   * theirs to close on the normal schedule, not something that snaps shut
   * mid-read.
   */
  const clearAnnounce = () => {
    if (announceRef.current) {
      clearTimeout(announceRef.current)
      announceRef.current = null
      unpin()
    }
  }

  useEffect(() => {
    if (inside) {
      // Any pending step down is cancelled the moment the cursor comes back —
      // including the retract of a banner the cursor did not ask for, which the
      // user has now reached for.
      clearGrace()
      clearAnnounce()
      unpin()

      if (state === 'hidden') {
        setState('peek')
        return
      }

      // A music banner dwells through to the full card just as the pill does:
      // reaching for something that reported a track is a request to see the
      // rest of it. A notification has no card behind it, so hovering only holds
      // it up to be read — the cancelled retract above is the whole behaviour,
      // and it collapses on the ordinary grace once the cursor leaves.
      const dwells =
        state === 'peek' ||
        (state === 'announce' && announcementRef.current?.kind === 'media')
      if (dwells) {
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

    if (state === resting || graceRef.current || pinned) return

    graceRef.current = setTimeout(() => {
      graceRef.current = null
      // One level at a time. This effect re-runs on the new state and, if the
      // cursor is still away, schedules the next step down — until it reaches the
      // floor, where the guard above stops scheduling.
      setState((current) => (current === 'expanded' ? 'peek' : resting))
    }, timing.graceMs)
    // `resting` is a dependency so that switching the preference off re-runs this
    // and lets a pill that was resting on screen collapse on the normal schedule.
    // `pinned` is one so that a lease running out does the same for a card the
    // tray opened and nobody came for.
  }, [inside, state, resting, pinned, unpin])

  // Switching the preference on should put the pill up straight away rather than
  // wait for the next hover. The opposite direction needs nothing: the effect
  // above re-runs on the new floor and steps the pill down for us.
  useEffect(() => {
    if (alwaysVisible) setState((current) => (current === 'hidden' ? 'peek' : current))
  }, [alwaysVisible])

  // Timers must not outlive the hook. `unpin` covers the pin lease, which is the
  // one that would otherwise still be holding a reference after unmount.
  useEffect(() => {
    return () => {
      clearDwell()
      clearGrace()
      clearAnnounce()
      unpin()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /**
   * Keep the overlay's z-order in step with whether it is on screen: topmost for
   * as long as anything is drawn, back to the band the preference selects once it
   * is gone.
   *
   * The window never takes focus, so anything that goes topmost after it — a
   * maximised window, a fullscreen video, another overlay — lands above it and
   * stays there. Nothing about that is specific to the preference being off: a
   * card the user reached for and cannot see is a broken notch either way. So the
   * raise is unconditional, and `notch_settle` on the way down is what keeps the
   * preference meaningful.
   *
   * Two rising edges trigger it, because either can be the first sign the user
   * wants the notch:
   *
   *  - the notch grew. Keyed on the rank rather than on leaving `hidden`, because
   *    with the pill resting on screen the notch leaves `hidden` exactly once, at
   *    startup, and a band lost hours later would never be reclaimed.
   *  - the cursor arrived. With the pill already resting at `peek` there is no
   *    growth to key on, and waiting for the dwell would leave the user hovering a
   *    pill buried under a fullscreen window with no feedback for 600ms.
   *
   * Both are edges, so this costs one call per reach rather than one per frame.
   * Rejects harmlessly in the browser fallback.
   */
  const lastRankRef = useRef(STATE_RANK.hidden)
  const wasInsideRef = useRef(false)
  useEffect(() => {
    const rank = STATE_RANK[state]
    const grew = rank > lastRankRef.current
    // Only the floor of a preference-off machine, i.e. nothing is drawn at all.
    // With the preference on the notch never gets here, and its band is already
    // the one `settle` would ask for.
    const gone = rank < lastRankRef.current && rank === STATE_RANK.hidden
    const reached = inside && !wasInsideRef.current

    lastRankRef.current = rank
    wasInsideRef.current = inside

    if (grew || reached) void invoke('notch_raise').catch(() => {})
    else if (gone) void invoke('notch_settle').catch(() => {})
  }, [state, inside])

  // Clicking away is the user moving on, so a pinned card should give up its hold
  // and collapse on the normal schedule. Only fires for an overlay that had focus
  // in the first place, i.e. one whose card was clicked — which is why the lease
  // exists and this is not the release anything relies on.
  useEffect(() => {
    window.addEventListener('blur', unpin)
    return () => window.removeEventListener('blur', unpin)
  }, [unpin])

  /**
   * Drop the banner in for `durationMs` and then take it away again: something
   * happened that the user should see without having gone looking for it — a
   * track starting to play, a notification arriving.
   *
   * Pinned like the tray's openings, and for the same reason: the cursor is
   * wherever the user was working, so the ordinary rules would count it as
   * "outside" and retract the banner inside the grace window rather than after
   * its own timer.
   *
   * The retract goes to the floor rather than stepping down through `peek`,
   * because there is nothing between a banner and rest — the intermediate pill
   * would blink for a grace window on the way out and read as a second event.
   */
  const announce = useCallback((next: Announcement, durationMs: number) => {
    // Already in use, by the cursor or by a card waiting to be read. Whatever is
    // on screen is more relevant than a report, and replacing it is worse than
    // staying quiet — the notch is already up, so nothing is being missed.
    if (insideRef.current || stateRef.current === 'expanded') return

    clearGrace()
    clearDwell()
    clearAnnounce()
    pin()
    setAnnouncement(next)
    // Music is the one announcement with a card behind it, so a dwell on that
    // banner should land on the media card rather than wherever the notch was
    // last left. A notification has nothing to open into and leaves the
    // selection alone.
    if (next.kind === 'media') setActiveModule('media')
    setState('announce')

    announceRef.current = setTimeout(() => {
      announceRef.current = null
      unpin()
      // Only from the banner itself: a dwell may have carried it to `expanded`
      // in the meantime, which is the user's card now and closes on their terms.
      setState((current) => (current === 'announce' ? restingRef.current : current))
    }, durationMs)
  }, [pin, unpin])

  const showModule = useCallback((module: NotchModule, options?: { pin?: boolean }) => {
    // Selecting a module is an explicit intent to stay open, so it beats a step
    // down that the poll loop may already have armed in the preceding frame —
    // or an auto-retract armed before the user got involved.
    clearGrace()
    clearDwell()
    clearAnnounce()
    if (options?.pin) pin()
    setActiveModule(module)
    setState('expanded')
  }, [pin])

  /** Open at whatever module is already selected. Used by the tray's "Show notch". */
  const expand = useCallback((options?: { pin?: boolean }) => {
    showModule(moduleRef.current, options)
  }, [showModule])

  /** Step through the modules, wrapping at both ends. */
  const cycleModule = useCallback((direction: 1 | -1) => {
    clearGrace()
    clearDwell()
    clearAnnounce()
    setActiveModule((current) => {
      const index = MODULES.indexOf(current)
      return MODULES[(index + direction + MODULES.length) % MODULES.length]
    })
    setState('expanded')
  }, [])

  const nextModule = useCallback(() => cycleModule(1), [cycleModule])
  const previousModule = useCallback(() => cycleModule(-1), [cycleModule])

  return {
    state,
    activeModule,
    announcement,
    showModule,
    expand,
    announce,
    nextModule,
    previousModule,
  }
}
