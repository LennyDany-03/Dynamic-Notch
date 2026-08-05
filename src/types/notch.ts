/** Visibility state machine. Single source of truth lives in `useNotchState`. */
export type NotchState = 'hidden' | 'peek' | 'expanded'

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
