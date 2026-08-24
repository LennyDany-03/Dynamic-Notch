/**
 * The countdown timer's stored shape, and the two ways it is read out.
 *
 * **Time is an instant, never a remaining.** `endsAt` is Unix millis, exactly as
 * `Reminder.dueAt` is, and for the same reason stated at the top of
 * `reminders.rs`: a stored "42 seconds left" needs something ticking to keep it
 * honest, and after a relaunch there was nothing ticking. An instant read against
 * the wall clock is right by construction, however long the app was closed.
 *
 * The one exception is `pausedRemainingMs`, which is a duration on purpose — a
 * paused timer has no instant, because the instant it lands on is not decided
 * until it is resumed.
 */

export interface TimerState {
  /**
   * What the timer was last started for, in ms. `0` when nothing has ever been
   * set.
   *
   * Kept after a timer finishes rather than cleared, which is the whole of "run
   * it again is one click": the card comes back to rest showing the duration that
   * just ran, with Start under the cursor. It is also the denominator the ring
   * and the perimeter trace are drawn from, so it has to outlive `endsAt`.
   */
  durationMs: number
  /** The instant it lands on. Null while paused or idle. */
  endsAt: number | null
  /** What was left when it was paused. Null unless paused. */
  pausedRemainingMs: number | null
}

export const IDLE_TIMER: TimerState = {
  durationMs: 0,
  endsAt: null,
  pausedRemainingMs: null,
}

/** Running, paused, or neither. Derived rather than stored — see `TimerState`. */
export type TimerPhase = 'idle' | 'running' | 'paused'

export function phaseOf(timer: TimerState): TimerPhase {
  if (timer.endsAt !== null) return 'running'
  if (timer.pausedRemainingMs !== null) return 'paused'
  return 'idle'
}

/**
 * Milliseconds left, at the moment asked.
 *
 * Takes `now` rather than calling `Date.now()` itself so that every surface
 * drawing this in one frame — the card, the trace, the pill chip — agrees to the
 * millisecond. Two readers each taking their own clock would disagree by however
 * long React took between them, which at a second boundary is the difference
 * between a chip reading 0:01 and a card reading 0:00.
 */
export function remainingMs(timer: TimerState, now: number): number {
  if (timer.endsAt !== null) return Math.max(0, timer.endsAt - now)
  if (timer.pausedRemainingMs !== null) return Math.max(0, timer.pausedRemainingMs)
  return timer.durationMs
}

/**
 * How far through, 0→1. `0` whenever there is no duration to be a fraction of.
 *
 * Elapsed rather than remaining, so the ring and the trace *fill* as time runs
 * down: an outline that emptied would say the opposite of what a countdown means.
 */
export function elapsedFraction(timer: TimerState, now: number): number {
  if (timer.durationMs <= 0) return 0
  const left = remainingMs(timer, now)
  return Math.min(1, Math.max(0, 1 - left / timer.durationMs))
}

/** `{ hours, minutes, seconds }`, each already zero-padded to two digits. */
export function splitDigits(ms: number): { h: string; m: string; s: string } {
  // Rounded *up*, which is the one arithmetic decision here that is visible.
  // A timer started for 5:00 renders 05:00 for its whole first second rather
  // than flicking to 04:59 the instant it starts, and it shows 00:01 for the
  // last full second rather than sitting on 00:00 while a second still runs.
  const total = Math.ceil(ms / 1000)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  return {
    h: `${Math.min(99, h)}`.padStart(2, '0'),
    m: `${m}`.padStart(2, '0'),
    s: `${s}`.padStart(2, '0'),
  }
}

/**
 * The reading for the pill chip and the nav strip, where the width is bounded.
 *
 * `columnWidth` in `CollapsedPill` gives the pill's outer columns 80px at the
 * default width and floors them at 72, and the chip is a 14px ring plus a gap
 * plus this. So it is two shapes rather than one: `m:ss` under an hour and
 * `Hh MMm` at an hour or more. Measured, the whole chip comes to 69px and 76.6px
 * respectively — the second is the tight one, and at the *minimum* pill width
 * (240, giving a 76px column) it overhangs by about half a pixel into the middle
 * column's own slack. That is the overhang `columnWidth` explicitly tolerates on
 * this side and is why the weather went left rather than beside the charge: the
 * right column is pinned to the pill's edge, so anything it outgrows is cut off,
 * while this one merely leans on space the clock is not using.
 *
 * The obvious `1:05:00` is what these two shapes exist to avoid. It measures ~44
 * of text against `Hh MMm`'s ~36, which puts the chip past 84 and genuinely into
 * the clock — the one thing the pill's grid exists to prevent.
 */
export function formatCompact(ms: number): string {
  const total = Math.ceil(ms / 1000)
  const h = Math.floor(total / 3600)
  if (h >= 1) return `${h}h ${`${Math.floor((total % 3600) / 60)}`.padStart(2, '0')}m`
  return `${Math.floor(total / 60)}:${`${total % 60}`.padStart(2, '0')}`
}

/**
 * The duration spoken in words, for the banner and for screen readers.
 *
 * Only the non-zero parts, because "0 hours 5 minutes 0 seconds" is not how
 * anyone says five minutes.
 */
export function describeDuration(ms: number): string {
  const total = Math.round(ms / 1000)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60

  const parts: string[] = []
  if (h > 0) parts.push(`${h} hour${h === 1 ? '' : 's'}`)
  if (m > 0) parts.push(`${m} minute${m === 1 ? '' : 's'}`)
  if (s > 0) parts.push(`${s} second${s === 1 ? '' : 's'}`)
  return parts.length > 0 ? parts.join(' ') : '0 seconds'
}

/**
 * The digits typed into the card, as a duration.
 *
 * The entry model is a phone timer's: a string of at most six digits that fills
 * `HHMMSS` from the right, so typing 5, 3, 0 gives `00 05 30` — five minutes
 * thirty. Minutes and seconds are read as-is rather than carried, because the
 * field is what the user is looking at: `00 99 99` on screen has to mean 99
 * minutes 99 seconds, or the readout and the timer disagree about what was typed.
 */
export function digitsToMs(digits: string): number {
  const padded = digits.padStart(6, '0').slice(-6)
  const h = Number(padded.slice(0, 2))
  const m = Number(padded.slice(2, 4))
  const s = Number(padded.slice(4, 6))
  return (h * 3600 + m * 60 + s) * 1000
}

/** The inverse, for seeding the field from a preset or a finished timer. */
export function msToDigits(ms: number): string {
  const { h, m, s } = splitDigits(ms)
  return `${h}${m}${s}`.replace(/^0+/, '')
}
