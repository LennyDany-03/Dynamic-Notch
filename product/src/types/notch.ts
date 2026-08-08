import type { WinNotification } from './notifications'

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
 * The first three are the design export's. `notifications` is not: the export
 * predates the notch reading the notification centre at all. It is the standing
 * list behind the banner — the banner reports one arrival and leaves, this is
 * where the ones you missed are still sitting.
 */
export type NotchModule = 'media' | 'launcher' | 'files' | 'notifications'

/** Display order for the nav arrows. */
export const MODULES: readonly NotchModule[] = [
  'media',
  'launcher',
  'files',
  'notifications',
] as const

/**
 * What an `announce` banner is reporting.
 *
 * The state machine carries this rather than a module, because an announcement
 * is not a module: `notification` has no card behind it to open, and `media`
 * borrows the media card only because one happens to exist. Kept as a tagged
 * union so a third source has to say what it is rather than being inferred from
 * whatever the notch was last showing.
 */
export type Announcement =
  | { kind: 'media' }
  | { kind: 'notification'; notification: WinNotification }

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
