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
 * The glyph's own coordinate system — a 26×14 box, drawn at `GLYPH`.
 *
 * The box is unchanged; what it is *drawn* at is not. This started at 18×9.7
 * with a 10.5px number beside it, which is smaller than any other readout the
 * notch has and was reported as simply too small to read — a 9.7px tall shell
 * leaves the fill inside it under 5px, so "how much have I got left" came down
 * to a two-pixel difference in the length of a grey smear. The number carries
 * the answer and the glyph carries the shape of it, so both grew: the mark is
 * now about a fifth larger and the number matches the nav strip's own type
 * rather than sitting a size below it.
 *
 * Both outer surfaces have room for it — the pill's side columns are fixed and
 * were already wider than the chip needed, and the nav strip is 26px tall — but
 * they are sized to this, so the two constants that mirror it (`COLUMN` in
 * `CollapsedPill`, `BADGE_WIDTH` in `NavArrows`) have to move with it.
 */
const GLYPH = { width: 22, height: 11.85 }

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
        gap: 5,
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
        width={GLYPH.width}
        height={GLYPH.height}
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
          // 12, not 10.5: the number is the whole answer, and it was set below
          // every other piece of type in the notch — smaller than the module
          // label two pixels away in the same strip.
          fontSize: 12,
          fontWeight: 600,
          letterSpacing: '.01em',
          color: battery.acPower || low ? tint : color.text.secondary,
          // Tabular and floored to the width of "100%", so a pill that is 100%
          // one minute and 99% the next does not shuffle everything beside it.
          fontVariantNumeric: 'tabular-nums',
          minWidth: 30,
          textAlign: 'right',
        }}
      >
        {percent}%
      </span>
    </span>
  )
}
