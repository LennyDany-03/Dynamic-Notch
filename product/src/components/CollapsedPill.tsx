import BatteryBadge from './system/BatteryBadge'
import WeatherBadge from './weather/WeatherBadge'
import { formatClock, useClock } from '../hooks/useClock'
import type { MediaSession } from '../hooks/useMediaSession'
import type { BatteryStatus } from '../types/system'
import type { Weather } from '../types/weather'
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
 * **The left column holds one mark at a time, and music displaces the weather.**
 * The temperature is the resting state — a readout opposite the charge is what
 * makes the pill a status strip rather than a clock with a decoration either
 * side — and the equalizer takes the slot for as long as something is playing.
 *
 * It is a swap rather than a pair for two reasons, and the design one is the
 * better one. Music is *news*: it changes on its own, it is the only thing on
 * this pill that does, and putting it beside a temperature that has not moved in
 * ten minutes makes the eye read the two as one crowded lump instead of noticing
 * the one that is moving. The weather is still one hover away in its own card,
 * and it comes back the moment the music stops. The size argument agrees: the eq
 * chip is ~28 across and the weather chip ~59, which with a gap is over 90
 * against a column that is 80 — and the outer columns are equal by construction
 * (see `COLUMN`), so the right one would have to grow to match and the clock
 * would lose the difference twice over, with nothing left to lose at the minimum
 * pill width. Either mark alone fits with room.
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

/**
 * Horizontal padding, and what the clock needs at its longest ("10:08 AM").
 *
 * 68 rather than 64 because the clock is set at 14 now rather than 13 — see the
 * note where it is drawn. This number is the floor the columns give way to
 * protect, so it has to follow the type it is protecting; left at 64 the clock
 * would begin clipping a preference or two before the columns started yielding.
 */
const PADDING = 12
const CLOCK_MIN = 68

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
 * It is the *right* column's number, and only the right column's, which is why
 * the weather went on the left rather than beside the charge: the charge sits at
 * `justifySelf: end` against the pill's edge, so anything it outgrows is cut
 * off, while the left chip is anchored at the other end and would merely
 * overhang into the middle column's own slack. It does not have to — the eq chip
 * is ~28 and the weather chip ~59, both clear of the 76 this floors to at the
 * narrowest pill — but that is the side with the room to be wrong on.
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
      {/* ── Music, or the weather ──────────────────────────────────────────
          One mark at a time. See the note at the top of the file for why music
          displaces the temperature rather than sitting beside it.

          Wordless on purpose, the music half: at rest the notch says *that*
          something is playing, and the title is one hover away in the card that
          can hold it. A track name here would be clipped by the third
          character.

          **Drawn only while audio is actually playing.** It used to be always
          there — dimmed with no session, and frozen low when paused — on the
          reasoning that a stable pill is a calm one. In use it was the
          opposite: the pill rests on screen all day for anyone with
          always-on-top set, so a permanent chip of three grey bars became a
          thing you stopped seeing, and then the *equalizer moving* stopped
          being news. An indicator that is present when there is nothing to
          indicate is decoration. The temperature underneath it is not that —
          it is a reading, not an indicator, and it is what the slot falls back
          to rather than something drawn over.

          With neither — nothing playing and no place set, which is the app's
          state until the user names one — the column is simply empty. It is
          fixed width, so the clock does not move either way, which is the
          reason the pill is a grid (see above) and the reason anything here
          can come and go at all. */}
      {isPlaying ? (
        <div
          className="tile"
          style={{
            justifySelf: 'start',
            display: 'flex',
            // Bottom-aligned, which is what the bars' `marginBottom` is
            // measured from.
            alignItems: 'flex-end',
            gap: 2.5,
            height: CHIP.height,
            padding: CHIP.padding,
            borderRadius: radius.pill,
            // As in the badge: clips the tile's top hairline to the pill's curve.
            overflow: 'hidden',
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
        </div>
      ) : (
        // Null on its own when no place is set, and the column stays empty.
        <div style={{ justifySelf: 'start', display: 'flex' }}>
          <WeatherBadge current={current} chip={CHIP} />
        </div>
      )}

      {/* ── The clock ──────────────────────────────────────────────────────
          The pill's content, and the only thing here set in type.

          14 rather than 13, which is the one change this surface needed. The
          marks either side are set at 12, so at 13 the clock was within a pixel
          of the things it is meant to be read *past* — three items of near-equal
          weight spread across a strip, with nothing saying which one the pill is
          for. A point of separation is enough to put the time first and let the
          readouts settle into being ambient, which is what they are: the clock is
          why anyone looks at the resting notch, and the charge and the
          temperature are what they notice while they are there. */}
      <span
        style={{
          justifySelf: 'center',
          fontSize: 14,
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
