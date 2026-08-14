import type { BatteryStatus } from '../../types/system'
import { color, radius } from '../../tokens'

/**
 * The charge, as a mark you can read without stopping — on the collapsed pill
 * and in the nav strip of every expanded card.
 *
 * The system banner reports the *moment* a charger goes in or comes out; this is
 * the standing answer to "how much have I got left", which is a different
 * question and the one asked far more often. Drawn in both resting surfaces on
 * purpose: the pill is what is on screen when nothing else is, and the nav strip
 * is what is on screen when something else is, so between them the charge is
 * always a glance away rather than a trip to the tray.
 *
 * Nothing is drawn on a machine with no battery, or one whose charge Windows will
 * not report — a desktop should not carry an empty battery outline forever, and
 * an unknown charge drawn as an empty one is a lie rather than a gap.
 *
 * No animation. The value moves by one point every few minutes, and a spring on
 * a bar this size would only ever be seen as a twitch out of the corner of the
 * eye.
 */

/** Charge at or below this, off mains, is drawn in the warning tint. */
const LOW = 20

/**
 * Two sizes, for the two surfaces this is drawn on.
 *
 * The box the glyph is drawn in is 26×14 in both; what changes is what it is
 * *rendered* at, and how big the number beside it is set.
 *
 * `full` is the pill. This started at the compact size everywhere, which is
 * smaller than any other readout the notch has and was too small to read — a
 * 9.7px tall shell leaves the fill inside it under 5px, so "how much have I got
 * left" came down to a two-pixel difference in the length of a grey smear. On
 * the pill the charge is one of three things on screen and has the room to be
 * read properly.
 *
 * `compact` is the nav strip, and is a correction to that: the strip is 26px
 * tall and already carries the module name, the counter and two chevrons, and
 * the full-size badge in there stopped being a status mark in the corner and
 * started competing with the name for the eye. Same drawing, less of it.
 *
 * Picked from `chip` rather than from a second prop, because there is only one
 * decision here — which surface this is on — and two props that always have to
 * agree is one that can be set wrong.
 */
const SIZES = {
  full: { glyph: { width: 22, height: 11.85 }, gap: 5, font: 12, number: 30 },
  compact: { glyph: { width: 18, height: 9.7 }, gap: 4, font: 11, number: 26 },
} as const

/**
 * The fill, inset evenly inside the shell's inner edge.
 *
 * The shell strokes 1.5 wide centred on its own path, so its inner edge runs
 * 1.5→21.5; 1.25 of clearance inside that is what is left. It used to be inset
 * 1.5 on the left and 2 on the right, which is invisible at 18px wide and is a
 * lopsided gap at 22.
 */
const BODY = { x: 2.75, width: 17.5 }

/**
 * The chip the pill wraps this in: a surface, not a control.
 *
 * Passed in rather than declared here because the pill also draws a matching one
 * around its music mark, and the two have to agree — the whole point of them is
 * that they are the same shape. The nav strip passes nothing and gets the bare
 * badge: its strip is 26px tall, and a 22px chip inside it would read as a button
 * squeezed into a title bar.
 *
 * Its absence also selects the compact size — see `SIZES`. One prop, because
 * "which surface am I on" is one question and the answer decides both.
 */
export interface Chip {
  height: number
  padding: string
}

export default function BatteryBadge({
  battery,
  chip,
}: {
  battery: BatteryStatus | null
  chip?: Chip
}) {
  if (!battery || battery.percent === null) return null

  const size = chip ? SIZES.full : SIZES.compact
  const percent = Math.max(0, Math.min(100, battery.percent))
  const low = percent <= LOW && !battery.acPower

  // Charging wins over low, because it is the newer fact: a battery at 8% with a
  // charger in is no longer a problem, and drawing it red would say it still is.
  const tint = battery.acPower ? color.accent : low ? color.fileRed : color.text.secondary

  return (
    <span
      // `tile` for the surface and its top hairline, so the chip is made of the
      // same material as everything inside the cards; the radius is overridden
      // because this one is a pill and the tiles are not.
      className={chip ? 'tile' : undefined}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: size.gap,
        flex: 'none',
        ...(chip && {
          height: chip.height,
          padding: chip.padding,
          borderRadius: radius.pill,
          // Clips `.tile::after` to the curve. That hairline is a full-width 1px
          // line drawn at the top of the box, which on a pill radius would hang
          // ten pixels past the fill at each end and read as a stray whisker.
          overflow: 'hidden',
          // The state, carried by the surface as well as by the glyph. Faint
          // enough to stay a background: the number is what is being read, and a
          // saturated chip at the top of the screen reads as an alert.
          ...(battery.acPower && { background: color.accentWash }),
          ...(low && { background: 'rgba(248,113,113,.14)' }),
        }),
      }}
      // Read by nothing on screen — the pill's marks are ambient — but this is
      // the whole content of the badge for a screen reader, which cannot see the
      // mark at all.
      aria-label={`Battery ${percent}%${battery.acPower ? ', charging' : ''}`}
      role="img"
    >
      <svg
        viewBox="0 0 26 14"
        width={size.glyph.width}
        height={size.glyph.height}
        style={{ flex: 'none', display: 'block' }}
      >
        <rect
          x="0.75"
          y="1.25"
          width="21.5"
          height="11.5"
          rx="3.5"
          fill="none"
          stroke={color.text.muted}
          strokeWidth={1.5}
        />
        {/* Terminal. Solid rather than outlined: at this size an outlined 2px
            cap fills in with its own stroke anyway. */}
        <rect x="23.6" y="5" width="1.9" height="4" rx="0.95" fill={color.text.muted} />

        {/* The charge that is *gone*, which is only worth drawing now the shell
            is big enough to hold it. Under the fill and the full length of it,
            so the two together read as a gauge rather than as a bar floating in
            an outline — at 33% the old badge was a short grey smear against
            nothing, and the thing being compared against was the shell, three
            pixels away and a different shape. `hover` because this is the same
            barely-there white the tiles lift by; anything stronger competes
            with the fill, which is the part being read. */}
        <rect
          x={BODY.x}
          y="3.5"
          width={BODY.width}
          height="7"
          rx="1.75"
          fill={color.hover}
        />

        <rect
          x={BODY.x}
          y="3.5"
          width={Math.max(1.5, (BODY.width * percent) / 100)}
          height="7"
          rx="1.75"
          fill={tint}
        />

        {/* The bolt sits over the fill, so it takes the fill's own contrast pair
            — and the fill here is always the accent, because the bolt is only
            drawn while charging. The outline is the accent itself, which is what
            keeps the bolt readable where it overhangs a nearly empty battery
            onto the card: white on a dark-grey hairline was the same pair by
            coincidence, and was a white bolt on a near-white fill under Mono. */}
        {battery.acPower && (
          <path
            d="M13.6 2.6L9.4 8.1h2.6l-.6 3.5 4.3-5.4h-2.7z"
            fill={color.onAccent}
            stroke={color.accent}
            strokeWidth={0.5}
            strokeLinejoin="round"
          />
        )}
      </svg>

      <span
        style={{
          // The number is the whole answer, so it is the half that is allowed to
          // stay legible even in the compact size — 11 against the module
          // label's own 10, rather than the 10.5 it started at.
          fontSize: size.font,
          fontWeight: 600,
          letterSpacing: '.01em',
          color: battery.acPower || low ? tint : color.text.secondary,
          // Tabular and floored to the width of "100%", so a pill that is 100%
          // one minute and 99% the next does not shuffle everything beside it.
          fontVariantNumeric: 'tabular-nums',
          minWidth: size.number,
          textAlign: 'right',
        }}
      >
        {percent}%
      </span>
    </span>
  )
}
