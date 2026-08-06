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

/**
 * Height of the nav row, which sits *inside* the Mica card along its top edge.
 *
 * The design export draws the dots on bare wallpaper below the card, but that is
 * an artefact of each mockup being framed in its own preview box — the gap varies
 * from 96px to 128px across the three states. Rendered literally, the dots land
 * a couple of hundred pixels below a short card in the middle of the desktop,
 * where they are effectively invisible and the other modules are unreachable.
 */
export const NAV_STRIP_HEIGHT = 26

const cardHeights = [size.media.height, size.launcher.height, size.files.height]
const cardWidths = [size.media.width, size.launcher.width, size.files.width]

/**
 * Interactive bounds while expanded are deliberately constant across modules —
 * the largest card in each axis. A rect that shrank under a stationary cursor
 * would collapse the notch the instant you clicked a nav dot to switch to a
 * shorter module.
 */
const EXPANDED_BOUNDS = {
  width: Math.max(...cardWidths),
  height: Math.max(...cardHeights),
}

export function cardSize(state: NotchState, module: NotchModule) {
  return state === 'expanded' ? size[module] : size.peek
}

/** Height available to module content, once the nav row is accounted for. */
export function contentHeight(module: NotchModule) {
  return size[module].height - NAV_STRIP_HEIGHT
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
