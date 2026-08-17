import WeatherIcon from './WeatherGlyphs'
import type { Chip } from '../system/BatteryBadge'
import { color, radius } from '../../tokens'
import { describeCode, formatTemp, type CurrentWeather } from '../../types/weather'

/**
 * The temperature, as a mark you can read without stopping — on the collapsed
 * pill and in the nav strip of every expanded card.
 *
 * `BatteryBadge` with a different reading, deliberately: the two are the notch's
 * standing answers to the two questions asked most often of a status strip, they
 * sit opposite each other on both surfaces, and so they take the same shape, the
 * same two sizes and the same `chip` prop selecting between them. If one of them
 * grows a third size, so does the other.
 *
 * Drawn only once the user has named a place in Settings — Crest does not guess
 * where they are, see `weather.rs` — so `null` is the app's default state and has
 * to leave no hole behind. It does: on both surfaces the column it sits in is
 * sized by something else, so an absent badge simply leaves it empty.
 *
 * No animation, for `BatteryBadge`'s reason: the value moves once every ten
 * minutes at most, and a spring on a mark this size would only ever be caught
 * out of the corner of the eye as a twitch.
 */

/**
 * The two sizes, and the one thing worth reading twice: `stroke` is in the
 * glyph's own 24-unit viewBox and therefore *scales with `glyph`*.
 *
 * The numbers are picked so both come out at the weight `BatteryBadge` is drawn
 * at beside them — 1.27 on the pill, 1.04 in the strip. Carrying the card's own
 * 1.5 across would stroke 0.94 at 15px and 0.88 at 14, which is not a stylistic
 * difference at that size but a weather mark that looks faded next to the charge
 * for no reason a reader can see.
 *
 * `number` is floored to the width of the widest temperature that fits without
 * padding the chip for everyone — two digits and a degree sign, which a minus
 * and two digits also fits inside at these weights — so the mark holds still as
 * the reading moves rather than shuffling the clock beside it.
 */
const SIZES = {
  full: { glyph: 15, stroke: 2, gap: 4, font: 12, number: 24 },
  compact: { glyph: 14, stroke: 1.8, gap: 3, font: 11, number: 21 },
} as const

export default function WeatherBadge({
  current,
  chip,
}: {
  current: CurrentWeather | null
  /**
   * The chip to draw this on, and — as in `BatteryBadge` — the selector for
   * which size to draw. Its *height* is the surface: 22 is the pill's chip and
   * 18 is the strip's, so one input decides both and there is no second prop
   * the first could be set out of step with.
   *
   * Passed in rather than declared here for the reason `BatteryBadge` gives:
   * each surface owns its own chip, and the two marks on a surface have to
   * agree — the whole point of them is that they are the same shape.
   *
   * Unlike the charge, this is never drawn bare. The charge can be, because a
   * battery outline is legible as a mark on any surface; a weather glyph beside
   * a number is two unlike things that need something to say they are one, and
   * the accent wash below is that something.
   */
  chip: Chip
}) {
  if (!current) return null

  const size = chip.height >= 22 ? SIZES.full : SIZES.compact
  const { label } = describeCode(current.code)

  return (
    <span
      // `tile` for the surface and its top hairline, so the badge is made of the
      // same material as the charge opposite it and as everything inside the
      // cards. The wash goes over that rather than instead of it.
      className="tile"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: size.gap,
        flex: 'none',
        height: chip.height,
        padding: chip.padding,
        borderRadius: radius.pill,
        // Clips `.tile::after` to the curve, as in the charge: that hairline is
        // a full-width 1px line drawn at the top of the box, which on a pill
        // radius would hang past the fill at each end as a stray whisker.
        overflow: 'hidden',
        // The accent, carried by the surface as well as by the glyph and the
        // number. `accentWash` rather than the accent itself for the reason the
        // charging chip gives: it has to stay a background — the temperature is
        // what is being read, and a saturated chip at the top of the screen
        // reads as an alert rather than as a readout.
        background: color.accentWash,
      }}
      // Ambient, like everything else on these two surfaces: nothing on screen
      // says this. It is the whole of the mark for a screen reader, which cannot
      // see the glyph at all, so the condition is spelled out here even though
      // the badge deliberately has no room to print it.
      aria-label={`${label}, ${formatTemp(current.temperature)}`}
      role="img"
    >
      {/* The card's own glyph rather than a second set drawn for this size, so
          the picture the pill shows for light rain is the picture the card shows
          for light rain.

          Both colours are the accent, which is what the badge is for. They are
          not the *same* accent: the base takes `accent` and precipitation takes
          `accentBright`, so rain and snow stay a step hotter than the cloud
          behind them and wet still reads differently from dry at a glance. Every
          value here is a `var()` off the one custom property, so this follows
          whatever accent or theme the user has picked with no component knowing
          a preference exists. */}
      <WeatherIcon
        code={current.code}
        size={size.glyph}
        strokeWidth={size.stroke}
        tone={color.accent}
        tint={color.accentBright}
      />

      <span
        style={{
          fontSize: size.font,
          fontWeight: 600,
          letterSpacing: '.01em',
          color: color.accent,
          // Tabular and floored, as the charge: a mark beside a clock must not
          // shuffle when 9° becomes 10°.
          fontVariantNumeric: 'tabular-nums',
          minWidth: size.number,
          textAlign: 'right',
        }}
      >
        {formatTemp(current.temperature)}
      </span>
    </span>
  )
}
