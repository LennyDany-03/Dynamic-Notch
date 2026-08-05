import { size } from './tokens'
import type { NotchModule, NotchState, Rect } from './types/notch'

/**
 * Geometry shared between the state machine (which hit-tests against it) and the
 * shell (which renders it). Keeping both readers on one module is what stops the
 * visible card and the interactive bounds from drifting apart.
 *
 * The overlay window is a fixed transparent canvas pinned to the top-centre of the
 * screen. Cards are drawn inside it and animated; the OS window itself is never
 * resized. Resizing a transparent, always-on-top window at 60fps on Windows makes
 * the backdrop-filter re-sample every frame, which tears badly — animating the
 * card inside a stable canvas gives the same result and stays smooth.
 */

/** Cards are pinned flush to the top edge of the screen. */
export const CARD_TOP = 0

/** Vertical gap between the tallest card and the nav dots row. */
export const NAV_GAP = 16

/** Hit height reserved for the nav row — the dots themselves are only 4px tall. */
export const NAV_ROW_HEIGHT = 20

const cardHeights = [size.media.height, size.launcher.height, size.files.height]
const cardWidths = [size.media.width, size.launcher.width, size.files.width]

const MAX_CARD_HEIGHT = Math.max(...cardHeights)
const MAX_CARD_WIDTH = Math.max(...cardWidths)

/**
 * Nav dots sit at a fixed y for every module rather than tracking each card's
 * bottom edge. If they moved with the card, switching from the 320px launcher to
 * the 124px media card would yank the dot out from under the cursor and trip the
 * exit grace timer the instant you clicked it.
 */
export const NAV_ROW_TOP = CARD_TOP + MAX_CARD_HEIGHT + NAV_GAP

/**
 * Interactive bounds while expanded are deliberately constant across modules —
 * full width and height of the largest layout. A rect that shrank under a
 * stationary cursor would collapse the notch mid-interaction.
 */
const EXPANDED_BOUNDS = {
  width: MAX_CARD_WIDTH,
  height: NAV_ROW_TOP + NAV_ROW_HEIGHT,
}

export function cardSize(state: NotchState, module: NotchModule) {
  return state === 'expanded' ? size[module] : size.peek
}

/**
 * Cursor-interactive bounds for the current state, in window-local CSS pixels.
 * `null` means nothing is rendered and the window should be fully click-through.
 */
export function contentRect(
  state: NotchState,
  _module: NotchModule,
  windowWidth: number,
): Rect | null {
  if (state === 'hidden') return null

  const centerX = windowWidth / 2

  if (state === 'peek') {
    return {
      x: centerX - size.peek.width / 2,
      y: CARD_TOP,
      width: size.peek.width,
      height: size.peek.height,
    }
  }

  return {
    x: centerX - EXPANDED_BOUNDS.width / 2,
    y: CARD_TOP,
    width: EXPANDED_BOUNDS.width,
    height: EXPANDED_BOUNDS.height,
  }
}
