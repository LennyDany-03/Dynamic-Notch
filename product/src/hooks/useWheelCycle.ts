import { useEffect, useRef } from 'react'

/**
 * Scroll over an open card to move through the ring.
 *
 * The arrows stay exactly as they were — this is a second way to reach the same
 * `cycleModule`, not a replacement. Clicking a 20px chevron is a small target at
 * the top of the screen, and the gesture people already make over a thing with
 * more than one page in it is a scroll.
 *
 * No hit-testing here, and none needed: the overlay sits in
 * `setIgnoreCursorEvents(true)` whenever the cursor is not over card content, so
 * the webview receives no wheel events at all unless the cursor is genuinely on
 * the card. The one place that is not true is the browser fallback, which has no
 * click-through and where the whole viewport stands in for the card anyway.
 *
 * Deliberately not wired at `peek`. `cycleModule` expands as it steps, so a
 * scroll over the resting pill would open the notch *and* move off whatever card
 * it opened on — you would never land on the one you asked for. Opening stays
 * the dwell's job.
 */

/**
 * How much accumulated delta makes a step.
 *
 * One notch of a mouse wheel is 100 in Chromium, so a single click of the wheel
 * clears this on its own and moves exactly one card. A trackpad emits a stream
 * of much smaller deltas, so it takes a deliberate swipe rather than the drift
 * of a hand resting on the pad.
 */
const THRESHOLD = 60

/**
 * How long after a step to swallow everything.
 *
 * This is not rate limiting, it is momentum. A trackpad keeps delivering events
 * for the better part of a second after the fingers have lifted, and without
 * this a flick would rip through the whole ring and land somewhere arbitrary.
 * The accumulator is held at zero for the duration, so what re-arms the gesture
 * is a fresh push, not the tail of the last one.
 */
const COOLDOWN_MS = 320

/** `deltaMode` is in lines or pages on some mice; normalise it to pixels. */
const DELTA_SCALE = [1, 16, 100]

/**
 * Whether anything under the cursor scrolls *on the axis being scrolled*.
 *
 * A card with a list in it — notifications, a day's reminders, the app picker —
 * has to keep scrolling that list, or the module becomes unreadable the moment
 * it holds more than fits. The test is *whether the region scrolls at all*, not
 * whether it has room left in the direction asked: falling through to the ring
 * at the end of a list would mean reading to the bottom of your notifications
 * and being thrown onto the weather, which is a worse surprise than a scroll
 * that does nothing.
 *
 * Axis-aware because the notes switcher is a horizontal strip. Checking only
 * `overflowY` would let a sideways swipe over it page the notch instead of
 * moving the strip — and checking either axis would hand that strip every
 * vertical wheel on the card, which it has no use for.
 */
function scrollable(target: EventTarget | null, axis: 'x' | 'y'): boolean {
  let node = target instanceof Element ? target : null

  while (node) {
    // The size test alone is true of any clipped content, the card included, so
    // the overflow rule has to agree with it.
    const clipped =
      axis === 'y'
        ? node.scrollHeight > node.clientHeight
        : node.scrollWidth > node.clientWidth

    if (clipped) {
      const style = getComputedStyle(node)
      const overflow = axis === 'y' ? style.overflowY : style.overflowX
      if (overflow === 'auto' || overflow === 'scroll') return true
    }

    node = node.parentElement
  }

  return false
}

export function useWheelCycle({
  enabled,
  onNext,
  onPrevious,
}: {
  enabled: boolean
  onNext: () => void
  onPrevious: () => void
}) {
  // Through refs so the listener is attached once and never re-attached: it is
  // registered non-passive, and swapping it on every render of a card that is
  // already animating is work for nothing.
  const handlers = useRef({ enabled, onNext, onPrevious })
  handlers.current = { enabled, onNext, onPrevious }

  useEffect(() => {
    let accumulated = 0
    let lockedUntil = 0

    const onWheel = (event: WheelEvent) => {
      if (!handlers.current.enabled) return
      // Ctrl+wheel is a zoom gesture, and a pinch on a trackpad arrives as one.
      if (event.ctrlKey) return

      // Whichever axis the gesture is actually on. A trackpad swiped sideways is
      // as good a "next" as a wheel turned down, and reads more like the paging
      // gesture this is standing in for.
      const vertical = Math.abs(event.deltaY) >= Math.abs(event.deltaX)
      const raw = vertical ? event.deltaY : event.deltaX
      const delta = raw * (DELTA_SCALE[event.deltaMode] ?? 1)
      if (delta === 0) return

      if (scrollable(event.target, vertical ? 'y' : 'x')) return

      // Nothing here scrolls, so the default is only ever a rubber-band or an
      // overscroll gesture on the window itself.
      event.preventDefault()

      const now = event.timeStamp
      if (now < lockedUntil) {
        accumulated = 0
        return
      }

      // A reversal is a new gesture, not a smaller one: without this, scrolling
      // up after scrolling down has to first pay off the balance it built.
      if (Math.sign(delta) !== Math.sign(accumulated)) accumulated = 0
      accumulated += delta

      if (Math.abs(accumulated) < THRESHOLD) return

      // Down and right go forward, which is the direction the right-hand chevron
      // points and the direction a page moves under a scroll.
      if (accumulated > 0) handlers.current.onNext()
      else handlers.current.onPrevious()

      accumulated = 0
      lockedUntil = now + COOLDOWN_MS
    }

    // Non-passive, because `preventDefault` is the whole point of the branch
    // above — React's own `onWheel` is registered passive at the root and could
    // not.
    window.addEventListener('wheel', onWheel, { passive: false })
    return () => window.removeEventListener('wheel', onWheel)
  }, [])
}
