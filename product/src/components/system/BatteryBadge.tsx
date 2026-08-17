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
 * **It is line work, and it has to be**, because it is never seen alone: the
 * temperature sits in the opposite corner of the same strip and the same pill,
 * and `WeatherGlyphs` are `fill: 'none'` stroke drawings with round caps. So the
 * shell is an outline, the terminal is a round-capped stroke rather than a solid
 * nub, and the gauge inside is a slim bar rather than a block filling the shell —
 * see `BAR`. The one deliberate exception is the charging bolt, which is filled,
 * for the reason given where it is drawn.
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
 * tall and already carries the module name and two chevrons, and the full-size
 * badge in there stopped being a status mark in the corner and started competing
 * with the name for the eye. Same drawing, less of it.
 *
 * Picked from the chip's *height* rather than from a second prop, because there
 * is only one decision here — which surface this is on — and two props that
 * always have to agree is one that can be set wrong. That is `WeatherBadge`'s
 * rule verbatim, which is the point: the two marks are meant to be the same
 * component with a different reading, and until this file matched it they were
 * two components that merely looked alike.
 */
const SIZES = {
  full: { glyph: { width: 22, height: 11.85 }, gap: 5, font: 12, number: 30 },
  compact: { glyph: { width: 18, height: 9.7 }, gap: 4, font: 11, number: 26 },
} as const

/**
 * The gauge inside the shell: the track, and the fill drawn over it.
 *
 * **Slim, and that is the redesign.** It was 7 units tall in a shell whose inner
 * height is 10 — a solid slab filling nearly the whole outline — and the problem
 * with that was not the battery on its own but the badge next to it. The weather
 * glyphs are `fill: 'none'` stroke drawings (see `WeatherGlyphs`), so two chips of
 * the same height and material carried two different *kinds of picture*: an airy
 * line cloud on one and a filled block on the other. Matching the chip made that
 * the last thing left unmatched.
 *
 * 4.6 keeps it unmistakably a gauge — it is still a bar of colour whose length is
 * the reading — while dropping enough ink that the mark reads as line work beside
 * the cloud. On screen that is 3.9px on the pill and 3.2px in the strip, against
 * the 5.9 and 4.9 it was.
 *
 * `radius` is half the height, so the bar is fully rounded and a nearly flat
 * battery degrades to a dot rather than to a squashed sliver. It is also the
 * floor the fill width is clamped to, for the same reason.
 *
 * `x` and `width`: the shell strokes 1.5 wide centred on its own path, so its
 * inner edge runs 1.5→21.5, and 1.25 of clearance inside that is what is left. It
 * used to be inset 1.5 on the left and 2 on the right, which is invisible at 18px
 * wide and a lopsided gap at 22. `y` centres the bar on that same inner box,
 * whose middle is 7.
 */
const BAR = { x: 2.75, width: 17.5, y: 4.7, height: 4.6, radius: 2.3 }

/**
 * The chip this is drawn on: a surface, not a control.
 *
 * Passed in rather than declared here because each surface owns its own — the
 * pill draws a matching one around its music mark, and the strip draws a
 * matching one around the temperature — and the marks on a surface have to
 * agree, since the whole point of them is that they are the same shape.
 *
 * **The strip used to pass nothing and get a bare mark**, on the reasoning that a
 * 22px chip inside a 26px strip reads as a button squeezed into a title bar.
 * That reasoning was right and the conclusion was wrong: the answer is the 18px
 * chip the temperature opposite was already using, not no chip at all. Bare, the
 * charge was the only readout in the app not sitting on a surface, so the two
 * corners of the same strip were a filled tag on one side and a naked outline on
 * the other — the single most visible thing wrong with the old strip, and the one
 * thing a screenshot of it shows before anything else.
 *
 * Its *height* selects the size — see `SIZES`. One prop, because "which surface
 * am I on" is one question and the answer decides both.
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
  chip: Chip
}) {
  if (!battery || battery.percent === null) return null

  const size = chip.height >= 22 ? SIZES.full : SIZES.compact
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
      className="tile"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: size.gap,
        flex: 'none',
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
        //
        // Neutral otherwise, which is what keeps this from competing with the
        // accent-washed temperature opposite: the two chips are the same shape
        // and the same material, and the fill is the one place they are allowed
        // to differ — the weather is always the accent, the charge only when it
        // has something to say.
        ...(battery.acPower && { background: color.accentWash }),
        ...(low && { background: 'rgba(248,113,113,.14)' }),
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
        {/* Terminal, as a round-capped stroke rather than the solid nub it was.
            Same footprint to a fraction of a unit — 1.9 wide, spanning y 5 to 9 —
            but drawn the way the cloud beside it is drawn, which is the whole
            point of this pass. A stroke here also picks up the round cap the
            weather glyphs use throughout. */}
        <path
          d="M24.55 5.95v2.1"
          fill="none"
          stroke={color.text.muted}
          strokeWidth={1.9}
          strokeLinecap="round"
        />

        {/* The charge that is *gone*. Under the fill and the full length of it,
            so the two together read as a gauge rather than as a bar floating in
            an outline — at 33% the old badge was a short grey smear against
            nothing, and the thing being compared against was the shell, three
            pixels away and a different shape. `hover` because this is the same
            barely-there white the tiles lift by; anything stronger competes
            with the fill, which is the part being read. That ratio is unchanged
            by the bar getting slimmer: both halves lost the same ink. */}
        <rect
          x={BAR.x}
          y={BAR.y}
          width={BAR.width}
          height={BAR.height}
          rx={BAR.radius}
          fill={color.hover}
        />

        <rect
          x={BAR.x}
          y={BAR.y}
          width={Math.max(BAR.radius, (BAR.width * percent) / 100)}
          height={BAR.height}
          rx={BAR.radius}
          fill={tint}
        />

        {/* The bolt sits over the fill, so it takes the fill's own contrast pair
            — and the fill here is always the accent, because the bolt is only
            drawn while charging. The outline is the accent itself, which is what
            keeps the bolt readable where it overhangs a nearly empty battery
            onto the card: white on a dark-grey hairline was the same pair by
            coincidence, and was a white bolt on a near-white fill under Mono.
            That overhang is now the common case rather than the edge one — the
            bar is 4.6 tall and the bolt is 9 — which is exactly why the outline
            was already there and why it does not need changing. */}
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
