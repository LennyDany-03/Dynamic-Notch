import BatteryBadge from './system/BatteryBadge'
import WeatherIcon from './weather/WeatherGlyphs'
import { formatClock, useClock } from '../hooks/useClock'
import type { MediaSession } from '../hooks/useMediaSession'
import type { BatteryStatus } from '../types/system'
import { describeCode, formatTemp, type Weather } from '../types/weather'
import { color, radius } from '../tokens'

/**
 * The collapsed pill — the notch at rest. 264×34 by default, and adjustable: see
 * `columnWidth` below for the one thing that follows from that.
 *
 * Three columns, and the reason it is a grid rather than the design export's row
 * with an absolutely-centred clock: the side columns are the *same fixed width*,
 * so the clock is centred by the layout itself and neither mark can ever reach
 * it. The absolute version worked by arithmetic — the clock spanned the whole
 * pill and the marks had to be kept narrow enough not to run into it — which is
 * how a battery readout ended up a pixel from the time. Here the badge can grow
 * to the full column and nothing moves.
 *
 * The two marks are matched chips, which is what makes this read as designed
 * rather than as three things that happen to be on the same strip: same height,
 * same radius, same surface as the tiles inside the cards. Their contents are
 * deliberately unlike — the music mark is ambient and wordless, the battery is a
 * number you read — so the chip is what says they are the same *kind* of thing,
 * a status the notch is holding for you.
 *
 * The music mark used to be two signals, the equalizer here and a matching dot on
 * the right, flanking the clock for symmetry. The dot is gone: it said exactly
 * what the equalizer says, and the symmetry it bought is now the grid's job.
 *
 * **The left chip carries two marks, not one**, and that is a size decision
 * rather than a taste one. The weather belongs on this side — it is the other
 * standing readout, and a temperature opposite the charge is what makes the pill
 * a status strip rather than a clock with decorations. But two *separate* chips
 * do not fit: the eq chip is ~28 across and a weather chip is ~55, which with a
 * gap is over 90, and the outer columns are equal by construction (see `COLUMN`)
 * so the right one would have to grow to match and the clock would lose the
 * difference twice over. At the minimum pill width there is no difference left
 * to lose. One chip holding both is 78 at its widest and fits the 80 the column
 * already has, and in the common case — nothing playing — it *is* a weather
 * chip, matched to the battery chip across the clock, which is the arrangement
 * the pill wanted anyway. Do not split it back into two without widening the
 * pill's default, and note that widening it silently is not an option either:
 * the width is a preference and an existing one would not move.
 */

/**
 * Both marks share these, which is the whole of the "they belong together".
 *
 * 22 rather than 20 because the badge inside it grew — see `GLYPH` there. The
 * chip has to stay the taller of the two by a clear margin or it stops reading
 * as a surface the mark sits *on*, and the pill is 34, which leaves 6 above and
 * below at this height.
 */
const CHIP = { height: 22, padding: '0 8px' } as const

/**
 * The weather mark's own sizes, inside that chip.
 *
 * The glyph is 15 rather than the card's 24: it sits beside a 12px number and a
 * glyph taller than its own text reads as an illustration rather than a label.
 * `stroke` is in the glyph's own viewBox units and so scales with it — 2 at 15px
 * is 1.25 on screen, which is the weight the battery badge beside it is drawn
 * at; the card's own 1.5 would come out at 0.94 and read as faded.
 * `number` is floored to the width of a two-digit temperature so the chip does
 * not shuffle when 9° becomes 10°, and is deliberately *not* wide enough for
 * "-15°" — a chip sized for the coldest reading it could ever hold would carry
 * six pixels of dead air for everyone else, and the couple of pixels a hard
 * freeze overhangs by land in the clock column's own slack rather than on the
 * clock.
 */
const WEATHER = { glyph: 15, stroke: 2, gap: 4, font: 12, number: 24 } as const

/**
 * Width of the two outer columns.
 *
 * Equal, so the clock lands on the pill's centre line, and wide enough for the
 * battery chip at its longest ("100%", plus a bolt) with room to spare. That
 * chip is now 73 across — 8 of padding, a 22 glyph, a 5 gap, the 30 the
 * percentage is floored to, 8 more — so this went to 80 with the badge; at the
 * old 74 the chip would have filled its column to within a pixel and the pill
 * would have looked crowded at exactly the corner the redesign was widening.
 *
 * The 14 comes out of the middle column, which keeps 80 for a clock that needs
 * about 55 at its longest ("10:08 AM").
 */
const COLUMN = 80

/** Horizontal padding, and what the clock needs at its longest ("10:08 AM"). */
const PADDING = 12
const CLOCK_MIN = 64

/**
 * The outer columns, at whatever width the pill has been set to.
 *
 * The pill is a preference now (`notchWidth`), and the grid above was written for
 * exactly one width: at the minimum of 240 two fixed 80s plus the padding leave
 * 16px for the clock, i.e. the pill's one piece of content elided to nothing while
 * the two decorations around it kept their full size. So the columns give way
 * first — they hold a chip that is allowed to be snug, and the clock is what the
 * pill is *for*.
 *
 * The floor is the battery chip's own 73 rounded down a little: below that the
 * charge would clip rather than tighten, and the answer at that point is a wider
 * pill rather than a badge that lies. It cannot actually be reached from the
 * slider — 240 gives 76 — which is the point: the bound exists so the arithmetic
 * is safe rather than because anything is expected to hit it.
 *
 * The floor is the *right* column's number, and only the right column's: the
 * charge sits at `justifySelf: end` against the pill's edge, so anything it
 * outgrows is cut off. The left chip is anchored at the other end and simply
 * overhangs into the middle column, which is 64 wide for a clock that needs
 * about 55 — so a 78px chip in a 76px column at the narrowest pill spends two
 * pixels of slack that is already there and moves nothing. That is why the
 * weather went on this side rather than beside the charge.
 */
function columnWidth(pillWidth: number) {
  return Math.max(72, Math.min(COLUMN, (pillWidth - PADDING * 2 - CLOCK_MIN) / 2))
}

export default function CollapsedPill({
  session,
  battery,
  weather,
  width,
}: {
  session: MediaSession
  battery: BatteryStatus | null
  /**
   * The current reading, or null when no place is set.
   *
   * Null is the default state of the app and stays null until the user names a
   * place in Settings — Crest does not guess where they are, see `weather.rs` —
   * so the chip has to be able to carry nothing without leaving a hole. It does:
   * with no weather and nothing playing there is no chip at all, which is the
   * pill exactly as it was.
   *
   * This costs no network. `useWeather` is already polling for the card whether
   * or not it is open, so the pill is reading a value the app had anyway.
   */
  weather: Weather | null
  /**
   * The pill's own width, from `layout.cardSize`.
   *
   * Passed in rather than measured, because this component lays out inside a card
   * that is *springing* to that width — `getBoundingClientRect` during the
   * animation would report whatever the spring had reached this frame and reflow
   * the columns on every one of them.
   */
  width: number
}) {
  const { media } = session
  const isPlaying = media?.isPlaying ?? false
  const current = weather?.current ?? null
  const now = useClock()
  const column = columnWidth(width)

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'grid',
        gridTemplateColumns: `${column}px 1fr ${column}px`,
        alignItems: 'center',
        padding: `0 ${PADDING}px`,
      }}
    >
      {/* ── Music and weather ──────────────────────────────────────────────
          The two ambient marks, in one chip. See the note at the top of the
          file for why they share it rather than taking a chip each.

          The whole chip is dropped when it would be empty, rather than drawn
          hollow: the column is fixed width, so the clock does not move — which
          is the reason the pill is a grid (see above) and the reason anything
          here can come and go at all. */}
      {isPlaying || current ? (
        <div
          className="tile"
          style={{
            justifySelf: 'start',
            display: 'flex',
            alignItems: 'center',
            // Between the two marks. The eq's own bars space themselves.
            gap: 6,
            height: CHIP.height,
            padding: CHIP.padding,
            borderRadius: radius.pill,
            // As in the badge: clips the tile's top hairline to the pill's curve.
            overflow: 'hidden',
          }}
        >
          {/* Wordless on purpose: at rest the notch says *that* something is
              playing, and the title is one hover away in the card that can
              hold it. A track name here would be clipped by the third
              character.

              **Drawn only while audio is actually playing.** It used to be
              always there — dimmed with no session, and frozen low when paused
              — on the reasoning that a stable pill is a calm one. In use it was
              the opposite: the pill rests on screen all day for anyone with
              always-on-top set, so a permanent chip of three grey bars became a
              thing you stopped seeing, and then the *equalizer moving* stopped
              being news. An indicator that is present when there is nothing to
              indicate is decoration. */}
          {isPlaying && (
            <span
              style={{
                display: 'flex',
                // Full chip height and bottom-aligned, which is the geometry the
                // bars had when they were the chip's only child. Centring the
                // 15.5px they actually occupy would lift them off the baseline
                // the `marginBottom` below is measured from and leave the
                // equalizer sitting high in its own chip.
                height: CHIP.height,
                alignItems: 'flex-end',
                gap: 2.5,
                flex: 'none',
              }}
              aria-label="Playing"
              role="img"
            >
              {[0, 0.2, 0.4].map((delay) => (
                <span
                  key={delay}
                  className="eq"
                  style={{
                    width: 2.5,
                    height: 11,
                    marginBottom: 4.5,
                    borderRadius: 2,
                    background: color.accentBright,
                    animationDelay: `${delay}s`,
                    transformOrigin: 'bottom',
                  }}
                />
              ))}
            </span>
          )}

          {/* The temperature, and the sky it belongs to.

              The glyph is the card's own — `WeatherGlyphs`, at 15 — rather than
              a second set drawn for this size, so the picture the pill shows for
              light rain is the picture the card shows for light rain. It also
              brings the card's colour rule with it, which is the whole of the
              colour-coding here: precipitation is stroked in the accent and
              everything else in the ordinary icon grey, so a glance at the pill
              distinguishes wet from dry without inventing a second palette that
              would then have to answer to whatever accent the user has picked.
              `accentBright` rather than `accent` to match the eq bars beside it
              — the accent proper is a fill colour and reads thin as a 1.5px
              stroke at this size.

              No condition text. "Partly cloudy" would be clipped by the second
              word, and the glyph is the label. */}
          {current && (
            <span
              style={{ display: 'flex', alignItems: 'center', gap: WEATHER.gap, flex: 'none' }}
              // Ambient like the rest of the pill, so nothing on screen says
              // this — but it is the whole of the mark for a screen reader.
              aria-label={`${describeCode(current.code).label}, ${formatTemp(current.temperature)}`}
              role="img"
            >
              <WeatherIcon
                code={current.code}
                size={WEATHER.glyph}
                strokeWidth={WEATHER.stroke}
                tint={color.accentBright}
              />
              <span
                style={{
                  fontSize: WEATHER.font,
                  fontWeight: 600,
                  letterSpacing: '.01em',
                  color: color.text.secondary,
                  // As the charge: floored and tabular, so the mark beside the
                  // clock holds still while the reading moves.
                  fontVariantNumeric: 'tabular-nums',
                  minWidth: WEATHER.number,
                }}
              >
                {formatTemp(current.temperature)}
              </span>
            </span>
          )}
        </div>
      ) : (
        <span aria-hidden />
      )}

      {/* ── The clock ──────────────────────────────────────────────────────
          The pill's content, and the only thing here set in type. */}
      <span
        style={{
          justifySelf: 'center',
          fontSize: 13,
          fontWeight: 600,
          letterSpacing: '-.01em',
          color: color.text.primary,
          whiteSpace: 'nowrap',
          // Stops the pill twitching as digits change width.
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {formatClock(now)}
      </span>

      {/* ── The charge ─────────────────────────────────────────────────────
          Its own chip, which also carries the state as a tint — see the badge.
          Nothing at all on a desktop, where the column simply stays empty and
          the clock stays where it was. */}
      <div style={{ justifySelf: 'end', display: 'flex' }}>
        <BatteryBadge battery={battery} chip={CHIP} />
      </div>
    </div>
  )
}
