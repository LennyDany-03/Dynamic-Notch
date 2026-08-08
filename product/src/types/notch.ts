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
 * Three for now, matching the design export. Becomes five once Launcher and
 * Clipboard are split apart and Notes gets its own page.
 */
export type NotchModule = 'media' | 'launcher' | 'files'

/** Display order for the nav dots. */
export const MODULES: readonly NotchModule[] = ['media', 'launcher', 'files'] as const

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
