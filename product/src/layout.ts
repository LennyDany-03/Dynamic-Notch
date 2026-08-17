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

/**
 * Height of one row in the notifications list. Read by `NotificationsModule`,
 * which pins its rows to exactly this, and by the height arithmetic below —
 * a row that measured itself would put the card and its hit rect out of step.
 */
export const NOTIFICATION_ROW_HEIGHT = 44

/**
 * Everything in the notifications card that is not a row: the nav strip, the
 * card's 16px padding top and bottom, the 20px header and the 10px gap under it.
 */
const NOTIFICATIONS_CHROME = NAV_STRIP_HEIGHT + 16 + 20 + 10 + 16

/**
 * How the notifications card is currently filled. It is the one card sized to its
 * contents, so both readers of the geometry have to be told what is in it.
 */
export interface NotificationsFit {
  /** Rows in the list. */
  rows: number
  /** Whether the detail sheet is open over them. */
  detail: boolean
}

/**
 * The notifications card, sized to its list.
 *
 * Every other card has one size because its contents do: the media card always
 * holds a track, the launcher always holds the same grid. This list holds
 * whatever is in the notification centre, and at the fixed 300 it left a stripe
 * of empty Mica under two notifications — the same dead zone `contentRect` warns
 * about below, only this time inside the visible card, where it also holds the
 * notch open over nothing.
 *
 * Grows a row at a time up to `size.notifications.height`, past which the list
 * scrolls; the row that ends up half-cut at the bottom is the scroll affordance.
 *
 * An empty list is measured in rows anyway, at two of them, because what fills it
 * is a sentence rather than a row — "Windows hasn't given Crest access…" wraps to
 * three lines on a narrow reading of the font, and the Mica surface clips.
 *
 * The detail sheet takes the full card whatever the list is doing: it is a
 * heading, a message and a footer over a scrim, and squeezed into a two-row card
 * the message itself gets about a line.
 */
export function notificationsCardHeight({ rows, detail }: NotificationsFit) {
  if (detail) return size.notifications.height

  const wanted = NOTIFICATIONS_CHROME + NOTIFICATION_ROW_HEIGHT * (rows > 0 ? rows : 2)
  return Math.min(wanted, size.notifications.height)
}

/**
 * The parts of the geometry the user gets to move.
 *
 * Threaded through as a value rather than read from a hook, because both readers
 * of this module are already downstream of one — `useNotchState` hit-tests with it
 * and `NotchShell` renders with it — and the single rule this file exists to
 * enforce is that those two never disagree. A preference either of them could read
 * *separately* is a preference they can be out of step about for a frame, and a
 * frame is exactly long enough for a click to land on a card that has moved.
 *
 * Everything here is a number the design already had; the preference changes what
 * it is, not what it means.
 */
export interface NotchMetrics {
  /** The resting pill, in CSS px. `size.peek` at the default. */
  pillWidth: number
  pillHeight: number
  /** Expanded card widths, as a percentage of the design's own. 100 = as drawn. */
  panelScale: number
}

/** The design export's own geometry — what the notch draws before any preference lands. */
export const DEFAULT_METRICS: NotchMetrics = {
  pillWidth: size.peek.width,
  pillHeight: size.peek.height,
  panelScale: 100,
}

/**
 * The overlay window, which is fixed at 560×420 in `tauri.conf.json` and never
 * resized (see the note at the top of this file).
 *
 * `CARD_MAX_WIDTH` is the ceiling every scaled width is clamped to, and the 20px
 * it leaves either side is not decoration: the Mica shell draws a hairline on its
 * top edge and the card springs *past* its target on the way in, so a card sized
 * to the canvas exactly would be clipped by the window during the overshoot.
 */
const CANVAS_WIDTH = 560
const CARD_MAX_WIDTH = CANVAS_WIDTH - 40

/**
 * A design width, scaled by the preference and clamped to the canvas.
 *
 * The clamp is why `panelScale`'s range can be generous: the calendar is 480 and
 * stops growing at 108%, while the media card at 380 keeps going to the top of the
 * range. A range picked so that the *widest* card could use all of it would barely
 * move any of the others.
 */
function panelWidth(base: number, metrics: NotchMetrics) {
  return Math.round(Math.min((base * metrics.panelScale) / 100, CARD_MAX_WIDTH))
}

export function cardSize(
  state: NotchState,
  module: NotchModule,
  metrics: NotchMetrics = DEFAULT_METRICS,
  fit?: NotificationsFit,
) {
  if (state === 'expanded') {
    if (module === 'notifications' && fit) {
      return {
        width: panelWidth(size.notifications.width, metrics),
        height: notificationsCardHeight(fit),
      }
    }
    return { width: panelWidth(size[module].width, metrics), height: size[module].height }
  }

  if (state === 'announce') {
    // The banner has to stay visibly wider than the pill it drops out of, or the
    // notch reporting something looks the same as the notch simply being there —
    // which `tokens.ts` states as the ceiling on the pill and which becomes a
    // floor on the banner the moment the pill is adjustable past it.
    return {
      width: Math.min(
        Math.max(panelWidth(size.announce.width, metrics), metrics.pillWidth + 36),
        CARD_MAX_WIDTH,
      ),
      height: size.announce.height,
    }
  }

  return { width: metrics.pillWidth, height: metrics.pillHeight }
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
  metrics: NotchMetrics = DEFAULT_METRICS,
  fit?: NotificationsFit,
): Rect | null {
  if (state === 'hidden') return null

  const card = cardSize(state, module, metrics, fit)
  return {
    x: windowWidth / 2 - card.width / 2,
    y: CARD_TOP,
    width: card.width,
    height: card.height,
  }
}
