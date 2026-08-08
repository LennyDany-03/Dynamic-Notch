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

export function cardSize(state: NotchState, module: NotchModule) {
  if (state === 'expanded') return size[module]
  if (state === 'announce') return size.announce
  return size.peek
}

/** Height available to module content, once the nav row is accounted for. */
export function contentHeight(module: NotchModule) {
  return size[module].height - NAV_STRIP_HEIGHT
}

/**
 * Cursor-interactive bounds for the current state, in window-local CSS pixels.
 * `null` means nothing is rendered and the window should be fully click-through.
 *
 * Exactly the card that is drawn — every state, every module. Anything larger is
 * a region of bare desktop that holds the notch open and swallows clicks with
 * nothing visible under the cursor to explain why.
 *
 * This used to return a constant rect while expanded, the largest card in each
 * axis, so that it could never shrink under a stationary cursor and collapse the
 * notch mid-click. That bought the invariant at the price of a permanent dead
 * zone: the media card is 380×164 and the rect was 440×346, so a cursor parked
 * 180px *below* the visible card — over a browser tab strip, say — kept the notch
 * expanded indefinitely. The invariant is still honoured, but by
 * `useNotchState`'s latch, which holds the old rect only for as long as the
 * cursor is actually inside it. Do not reintroduce a maximum here.
 */
export function contentRect(
  state: NotchState,
  module: NotchModule,
  windowWidth: number,
): Rect | null {
  if (state === 'hidden') return null

  const card = cardSize(state, module)
  return {
    x: windowWidth / 2 - card.width / 2,
    y: CARD_TOP,
    width: card.width,
    height: card.height,
  }
}
