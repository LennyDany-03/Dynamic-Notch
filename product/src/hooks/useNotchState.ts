import { useCallback, useEffect, useRef, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { useHotzone } from './useHotzone'
import { DEFAULT_METRICS, contentRect, type NotchMetrics, type NotificationsFit } from '../layout'
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
 * and dwells through to a full card, exactly as it would on the pill. It borrows
 * the *selection* too, for the kinds with a card behind them, and gives it back
 * when it retracts untouched.
 *
 * Two things hold the step down off, and neither is the cursor: `pinned`, for an
 * opening the cursor did not cause, and `typing`, for a caret in a field on the
 * card. Both are leased, because a hold with no expiry is how a card ends up on
 * screen for the life of the process.
 */
export function useNotchState({
  alwaysVisible = false,
  notificationsFit,
  modules = MODULES,
  metrics = DEFAULT_METRICS,
  graceMs = timing.graceMs,
}: {
  alwaysVisible?: boolean
  /**
   * What the notifications card currently holds. The one card whose height is a
   * function of its contents, so the hit rect cannot be derived from the state and
   * the module alone — see `layout.notificationsCardHeight`.
   */
  notificationsFit?: NotificationsFit
  /**
   * The cards the arrows cycle, in order — the `panels` preference, resolved.
   *
   * Defaults to `MODULES` so the browser fallback and any caller that does not
   * care still gets the full ring. Guaranteed non-empty by `resolvePanels`, which
   * is what lets `cycleModule` index into it without a guard.
   */
  modules?: readonly NotchModule[]
  /**
   * The adjustable half of the geometry — the pill's size and the card width
   * scale. Passed straight to `layout.contentRect`, which is the only thing here
   * that reads it.
   *
   * It reaches this hook rather than only `NotchShell` because the two have to
   * agree: this is the half that hit-tests, and a rect derived from the design's
   * geometry while the card is drawn at the user's would be a card you could see
   * and not click.
   */
  metrics?: NotchMetrics
  /**
   * How long the cursor has to be away before the notch steps down — the
   * `collapseDelay` preference, defaulting to the design's own `timing.graceMs`.
   *
   * Only the *grace* window is adjustable, not the dwell. They read like a pair
   * and are not one: the dwell is how long you have to mean it before the notch
   * opens, which is a guard against opening by accident and has a right answer;
   * this is how long the notch stays after you have finished with it, which is
   * taste, and is the one users actually complain about in both directions.
   */
  graceMs?: number
} = {}) {
  const [state, setState] = useState<NotchState>('hidden')
  const [activeModule, setActiveModule] = useState<NotchModule>(() => modules[0] ?? 'media')

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
  const metricsRef = useRef(metrics)
  metricsRef.current = metrics
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
      metricsRef.current,
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

  /**
   * Set while the user is typing into the card — a task in the calendar, a note
   * in the shelf.
   *
   * Typing is the one use of the notch the cursor stops reporting. The hand is
   * off the mouse, so the pointer sits wherever it was left, and if that is a few
   * pixels past the card's edge the ordinary grace window collapses the card
   * mid-sentence. It is the same problem the pin solves for the tray — something
   * other than the cursor is keeping the notch in use — so it takes the same
   * shape, including the lease: a hold that only ended when the field lost focus
   * would keep a card on screen for the life of the process for anyone who
   * clicked into a note and then went to lunch, which is the bug `pinMs` exists
   * to have already fixed once.
   *
   * Three releases, exactly as there: the field losing focus, the window
   * blurring, and `timing.typingMs` since the last keystroke — and the lease is
   * again the only one that always fires.
   *
   * State rather than a ref, for the same reason `pinned` is: the step-down
   * effect is guarded on it, so releasing the hold has to re-render for the
   * ordinary collapse to be scheduled.
   */
  const [typing, setTyping] = useState(false)
  const typingLeaseRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const stopTyping = useCallback(() => {
    if (typingLeaseRef.current) {
      clearTimeout(typingLeaseRef.current)
      typingLeaseRef.current = null
    }
    setTyping(false)
  }, [])

  const keepTyping = useCallback(() => {
    if (typingLeaseRef.current) clearTimeout(typingLeaseRef.current)
    // A no-op re-render-wise once it is already true, which is what makes this
    // safe to call on every keystroke.
    setTyping(true)
    typingLeaseRef.current = setTimeout(() => {
      typingLeaseRef.current = null
      setTyping(false)
    }, timing.typingMs)
  }, [])

  /**
   * What counts as typing: a caret in a field somewhere on the card.
   *
   * Read off the events rather than tracked per component. The alternative is
   * every text field in the app reporting itself to the state machine, which is
   * four call sites today and one forgotten one per card added — and the thing
   * being asked about ("does the document have a caret in it") is precisely what
   * the DOM already answers.
   */
  useEffect(() => {
    const editable = (node: EventTarget | null): boolean => {
      const element = node as HTMLElement | null
      if (!element || typeof element.tagName !== 'string') return false
      return (
        element.tagName === 'INPUT' ||
        element.tagName === 'TEXTAREA' ||
        element.isContentEditable
      )
    }

    const onFocusIn = (event: FocusEvent) => {
      if (editable(event.target)) keepTyping()
    }
    const onFocusOut = (event: FocusEvent) => {
      if (editable(event.target)) stopTyping()
    }
    // Re-arms the lease. `focusin` alone would start the clock at the click and
    // let it run out under someone who is still typing.
    const onKeyDown = () => {
      if (editable(document.activeElement)) keepTyping()
    }

    document.addEventListener('focusin', onFocusIn)
    document.addEventListener('focusout', onFocusOut)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('focusin', onFocusIn)
      document.removeEventListener('focusout', onFocusOut)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [keepTyping, stopTyping])

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
   * The card the user themselves last chose, held while a banner borrows the
   * selection — see `announce`, which points the dwell at the card behind the
   * thing it is reporting.
   */
  const restoreModuleRef = useRef<NotchModule | null>(null)

  /**
   * Abandon a pending auto-retract. Called whenever the user takes the banner
   * over — hovering it, or picking a module — after which what is on screen is
   * theirs to close on the normal schedule, not something that snaps shut
   * mid-read.
   *
   * That is also the moment the borrowed selection stops being borrowed: a user
   * who reached for a music banner is on the media card because they asked to be,
   * and putting them back on the calendar afterwards would be the same silent
   * swap in the other direction.
   */
  const clearAnnounce = () => {
    restoreModuleRef.current = null
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
      // rest of it. An overload banner does the same, and more sharply — it has
      // just said the machine is struggling, and the card behind it is where the
      // other three meters and the power row are. A screenshot banner is the most
      // pointed of the lot: the reason to look at a capture is to put it
      // somewhere, and the card behind it is where it can be dragged from. A
      // notification or a charger has no card behind it, so hovering those only
      // holds them up to be read — the cancelled retract above is the whole
      // behaviour, and they collapse on the ordinary grace once the cursor leaves.
      const kind = announcementRef.current?.kind
      const dwells =
        state === 'peek' ||
        (state === 'announce' &&
          (kind === 'media' ||
            kind === 'performance' ||
            kind === 'reminder' ||
            kind === 'screenshot'))
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

    // `typing` joins the pin as a reason not to schedule a step down, and for the
    // same reason: something other than the cursor says the notch is in use. When
    // it releases, this effect re-runs on the new value and the ordinary grace
    // window takes over from wherever the card had got to.
    if (state === resting || graceRef.current || pinned || typing) return

    graceRef.current = setTimeout(() => {
      graceRef.current = null
      // One level at a time. This effect re-runs on the new state and, if the
      // cursor is still away, schedules the next step down — until it reaches the
      // floor, where the guard above stops scheduling.
      setState((current) => (current === 'expanded' ? 'peek' : resting))
    }, graceMs)
    // `resting` is a dependency so that switching the preference off re-runs this
    // and lets a pill that was resting on screen collapse on the normal schedule.
    // `pinned` is one so that a lease running out does the same for a card the
    // tray opened and nobody came for, and `typing` for the same reason — a field
    // that has gone quiet or lost focus has to hand the card back to the ordinary
    // rules. `graceMs` is one so that a new delay takes effect on the next step
    // down rather than on the next relaunch — it is adjusted from a slider, and a
    // preference you have to restart for is one the user cannot feel themselves
    // choosing.
  }, [inside, state, resting, pinned, typing, unpin, graceMs])

  // Switching the preference on should put the pill up straight away rather than
  // wait for the next hover. The opposite direction needs nothing: the effect
  // above re-runs on the new floor and steps the pill down for us.
  useEffect(() => {
    if (alwaysVisible) setState((current) => (current === 'hidden' ? 'peek' : current))
  }, [alwaysVisible])

  // Timers must not outlive the hook. `unpin` and `stopTyping` cover the two
  // leases, which are the ones that would otherwise still be holding a reference
  // after unmount.
  useEffect(() => {
    return () => {
      clearDwell()
      clearGrace()
      clearAnnounce()
      unpin()
      stopTyping()
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

  // Clicking away is the user moving on, so a card holding itself open should give
  // up that hold and collapse on the normal schedule — the tray's pin and the
  // caret in a text field alike. Only fires for an overlay that had focus in the
  // first place, i.e. one whose card was clicked — which is why both have a lease
  // and this is not the release either of them relies on.
  //
  // It matters more for typing than for the pin, because typing *is* how the
  // overlay gets focus: the field asks for it on pointer-down, so clicking into
  // another app is the one gesture guaranteed to blur this window.
  useEffect(() => {
    const onBlur = () => {
      unpin()
      stopTyping()
    }
    window.addEventListener('blur', onBlur)
    return () => window.removeEventListener('blur', onBlur)
  }, [unpin, stopTyping])

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

    // Read before `clearAnnounce` drops it, so a second banner landing on top of
    // the first still restores the card the *user* left open rather than the one
    // the first banner borrowed.
    const held = restoreModuleRef.current

    clearGrace()
    clearDwell()
    clearAnnounce()
    pin()
    setAnnouncement(next)
    // The announcements with a card behind them point the dwell at it, so
    // reaching for the banner lands on the thing it was about rather than on
    // wherever the notch was last left. The rest have nothing to open into and
    // leave the selection alone.
    //
    // Which makes this a *borrow*: the banner moves a selection the user made,
    // for a report they never asked for. Left there, a track changing while the
    // notch was collapsed would silently take someone off the card they had been
    // reading and the next hover would land somewhere they did not choose. So the
    // old selection is kept and put back by the retract below.
    restoreModuleRef.current = held ?? moduleRef.current
    if (next.kind === 'media') setActiveModule('media')
    if (next.kind === 'performance') setActiveModule('system')
    if (next.kind === 'reminder') setActiveModule('calendar')
    if (next.kind === 'screenshot') setActiveModule('screenshots')
    setState('announce')

    announceRef.current = setTimeout(() => {
      announceRef.current = null
      unpin()
      // Only from the banner itself: a dwell may have carried it to `expanded`
      // in the meantime, which is the user's card now and closes on their terms —
      // and `clearAnnounce` has already dropped the restore on the way there.
      if (stateRef.current !== 'announce') return
      const restore = restoreModuleRef.current
      restoreModuleRef.current = null
      // A no-op for the kinds that never moved the selection; React bails out on
      // a set to the value already held.
      if (restore) setActiveModule(restore)
      setState(restingRef.current)
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

  /**
   * Open the notch, or put it away if it is already open. The summon shortcut.
   *
   * A toggle rather than a plain "show", because the shortcut is the one way in
   * that does not involve the cursor — and so it is the only one with no way *out*.
   * Every other opening is dismissed by moving the mouse, which the user is doing
   * anyway; someone who summoned a card from the keyboard and wants it gone would
   * otherwise have to reach for the mouse to dismiss a feature whose whole point
   * was not having to.
   *
   * Pinned on the way in for the same reason the tray's openings are: the cursor is
   * wherever the user was working, so the ordinary rules would count it as
   * "outside" and collapse the card inside the grace window. On the way out it
   * goes straight to the floor rather than stepping down through `peek`, because a
   * dismissal is not a collapse — the intermediate pill would read as the notch
   * having half-ignored the keystroke.
   */
  const toggle = useCallback(() => {
    clearGrace()
    clearDwell()
    clearAnnounce()

    if (stateRef.current === 'expanded') {
      unpin()
      setState(restingRef.current)
      return
    }

    showModule(moduleRef.current, { pin: true })
    // `clearAnnounce` and `unpin` are stable, and `restingRef` is read through a
    // ref precisely so this callback does not change identity when the
    // always-on-top preference does — it is handed to an event listener.
  }, [showModule, unpin])

  /**
   * Step through the modules, wrapping at both ends.
   *
   * Reads the ring from a ref rather than closing over it, so switching a card
   * off in Settings does not hand every consumer a new `nextModule`/`previousModule`
   * identity — `NotchShell` takes them as props and would re-render the whole card
   * for a preference change that only matters at the moment an arrow is clicked.
   *
   * `indexOf` can be -1 when the active card has just been switched off. `-1 + 1`
   * lands on index 0 and `-1 - 1` wraps to the last, both of which are reasonable
   * places to arrive — and the effect below will usually have moved off it first.
   */
  const modulesRef = useRef(modules)
  modulesRef.current = modules

  const cycleModule = useCallback((direction: 1 | -1) => {
    clearGrace()
    clearDwell()
    clearAnnounce()
    setActiveModule((current) => {
      const ring = modulesRef.current
      const index = ring.indexOf(current)
      return ring[(index + direction + ring.length) % ring.length]
    })
    setState('expanded')
  }, [])

  /**
   * Follow the preference when the card on screen is switched off.
   *
   * Without this the notch keeps drawing a card the user has just removed — and
   * worse, one the arrows can no longer reach, because `cycleModule` steps from a
   * position in the ring that no longer contains it. Moving to the first visible
   * card is the least surprising landing: it is the one the notch opens on
   * anyway.
   *
   * Deliberately not `showModule`: this is a correction, not an intent. Changing
   * the state would expand the notch in front of a user who is in the settings
   * window ticking boxes.
   */
  useEffect(() => {
    setActiveModule((current) => (modules.includes(current) ? current : modules[0]))
  }, [modules])

  const nextModule = useCallback(() => cycleModule(1), [cycleModule])
  const previousModule = useCallback(() => cycleModule(-1), [cycleModule])

  return {
    state,
    activeModule,
    announcement,
    showModule,
    expand,
    toggle,
    announce,
    nextModule,
    previousModule,
  }
}
