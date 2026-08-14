import type { WinNotification } from './notifications'
import type { PerfAlert } from './perf'
import type { Reminder } from './reminders'
import type { SystemEvent } from './system'

/**
 * Visibility state machine. Single source of truth lives in `useNotchState`.
 *
 * `announce` is the one state the cursor never asks for: a banner the notch drops
 * in by itself to report something (music starting) and retracts on a timer. It
 * sits between the pill and a full card in every sense — bigger than `peek`,
 * smaller and shorter-lived than `expanded` — and hovering it dwells through to
 * `expanded` exactly as hovering the pill does.
 */
export type NotchState = 'hidden' | 'peek' | 'announce' | 'expanded'

/**
 * How much of the notch each state puts on screen, so callers can compare two
 * states rather than enumerate them.
 *
 * The floor is not always `hidden` — with the always-on-top preference set the
 * pill rests on screen permanently — so "did the notch just grow or shrink?" can
 * no longer be answered by testing against a single state name.
 */
export const STATE_RANK: Record<NotchState, number> = {
  hidden: 0,
  peek: 1,
  announce: 2,
  expanded: 3,
}

/**
 * Which page is showing while expanded. Independent of `NotchState` so that
 * switching modules resizes the card without retriggering the expand animation.
 *
 * The first three are the design export's. The last two are not: the export
 * predates the notch reading the notification centre at all, and predates it
 * watching the machine.
 *
 * `notifications` is the standing list behind the notification banner — that one
 * reports an arrival and leaves, this is where the ones you missed are sitting.
 * `system` is the same relationship to the performance banner, and adds the one
 * thing on the notch that is not a readout: sleep, restart and shut down. Those
 * live here rather than in the tray popup because the reason to reach for them is
 * almost always the reason you are looking at the meters.
 */
export type NotchModule =
  | 'media'
  | 'launcher'
  | 'files'
  | 'notifications'
  | 'system'
  | 'weather'
  | 'calendar'

/**
 * Display order for the nav arrows, and the order the "n/5" counter reads in.
 *
 * Appended rather than inserted: the position of a module is the only thing the
 * arrows can be aimed by, and a user who knows the shelf is two right of media
 * should not have that quietly changed by a release. Nothing about `system`
 * makes it belong somewhere in particular — the arrows wrap, so no slot in a
 * five-item ring is meaningfully further from any other.
 */
export const MODULES: readonly NotchModule[] = [
  'media',
  'launcher',
  'files',
  'notifications',
  'system',
  'weather',
  'calendar',
] as const

/**
 * What an `announce` banner is reporting.
 *
 * The state machine carries this rather than a module, because an announcement
 * is not a module: `notification` and `system` have no card behind them to open,
 * and `media` borrows the media card only because one happens to exist. Kept as a
 * tagged union so each new source has to say what it is rather than being
 * inferred from whatever the notch was last showing.
 *
 * `system` is the machine reporting itself — a charger, a Bluetooth device, the
 * network. It carries the whole event rather than a subsystem name for the same
 * reason `notification` carries the notification: the banner reports one specific
 * thing having just happened, not the standing state of a thing.
 *
 * `performance` is the machine struggling and `reminder` is a time the user
 * asked to be told about. Both have a card behind them: like `media`, hovering
 * them dwells through to somewhere the user can act on what they were just told —
 * the meters and the power row, or the day the reminder is on. `notification` and
 * `system` have nowhere to go, and hovering those only holds them up to be read.
 */
export type Announcement =
  | { kind: 'media' }
  | { kind: 'notification'; notification: WinNotification }
  | { kind: 'system'; event: SystemEvent }
  | { kind: 'performance'; alert: PerfAlert }
  | { kind: 'reminder'; reminder: Reminder }

/** A rectangle in window-local CSS pixels. */
export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

export function rectContains(rect: Rect, x: number, y: number): boolean {
  return x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height
}
