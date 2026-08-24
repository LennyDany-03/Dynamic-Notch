import type { Chip } from '../system/BatteryBadge'
import { color, radius } from '../../tokens'
import {
  elapsedFraction,
  formatCompact,
  phaseOf,
  remainingMs,
  type TimerState,
} from '../../types/timer'

/**
 * The running timer, as a mark you can read without stopping — on the collapsed
 * pill and in the nav strip of every expanded card.
 *
 * `WeatherBadge` with a different reading, deliberately, exactly as that one is
 * `BatteryBadge` with a different reading: same `Chip` prop selecting the same
 * two sizes off its height, same `accentWash` surface, same tabular floored
 * number. These three are the notch's standing readouts and they take the same
 * shape; if one of them grows a third size, so do the others.
 *
 * **It displaces both of the others.** The priority on the pill is timer › music
 * › weather, and the timer wins because it is the only one of the three with a
 * *deadline*. The temperature has not moved in ten minutes and the track is one
 * hover away in a card that can hold its title; the countdown is the one mark
 * whose whole value is that you can see it without asking — and the one that is
 * about to stop being true. It gives the slot straight back on reset.
 *
 * **Drawn while paused as well as while running.** A paused timer that vanished
 * from the pill is a timer you forget you have, and then find at nine minutes
 * left the next morning. Paused draws the ring static and the reading at
 * `text.secondary`, so it is visibly *held* rather than moving.
 *
 * Nothing at all while idle: the column it sits in is sized by something else on
 * both surfaces, so an absent badge simply leaves it empty and nothing shifts.
 */

/**
 * The two sizes.
 *
 * As in `WeatherBadge`, `stroke` is in the ring's own 24-unit viewBox and so
 * scales with `glyph` — the numbers are picked to land at the weight the charge
 * is drawn at beside them rather than carried across from some other size.
 *
 * `number` is floored to the widest reading each format produces, so the mark
 * holds still as the seconds run rather than shuffling the clock beside it.
 * That floor is also the whole reason `formatCompact` has two shapes: the pill's
 * outer columns are 80px at the default width and bottom out at 72, and a plain
 * `1:05:00` would push the chip into the clock. Measured, the chip comes to 69px
 * under an hour and 76.6px over one — see `formatCompact` for what happens to
 * the second of those at the narrowest pill.
 */
const SIZES = {
  full: { glyph: 15, stroke: 2.4, gap: 4, font: 12, number: 34 },
  compact: { glyph: 14, stroke: 2.2, gap: 3, font: 11, number: 31 },
} as const

/** The ring's geometry inside its viewBox. */
const RING = { cx: 12, cy: 12, r: 8.6 }
const CIRCUMFERENCE = 2 * Math.PI * RING.r

export default function TimerBadge({
  timer,
  now,
  chip,
}: {
  timer: TimerState
  /**
   * The clock, from `useTimer`.
   *
   * Passed in rather than sampled here so this and the card agree to the
   * millisecond — see `TimerFeed.now`. It is also what makes this component
   * re-render at all: it holds no state and reads no clock of its own.
   */
  now: number
  /**
   * The chip to draw on, and the selector for which size to draw at — its
   * *height* is the surface, 22 on the pill and 18 in the nav strip.
   *
   * Passed in rather than declared here for `BatteryBadge`'s reason: each
   * surface owns its own chip and the marks on a surface have to agree, since
   * the whole point of them is that they are the same shape.
   */
  chip: Chip
}) {
  const phase = phaseOf(timer)
  if (phase === 'idle') return null

  const size = chip.height >= 22 ? SIZES.full : SIZES.compact
  const running = phase === 'running'
  const left = remainingMs(timer, now)
  const progress = elapsedFraction(timer, now)
  const reading = formatCompact(left)

  // Paused steps back a shade rather than changing colour. The accent is what
  // says "this is the timer"; a paused one is the same fact, held.
  const tint = running ? color.accent : color.text.secondary

  return (
    <span
      // `tile` for the surface and its top hairline, so the badge is made of the
      // same material as the charge opposite it. The wash goes over that rather
      // than instead of it.
      className="tile"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: size.gap,
        flex: 'none',
        height: chip.height,
        padding: chip.padding,
        borderRadius: radius.pill,
        // Clips `.tile::after` to the curve: that hairline is a full-width 1px
        // line at the top of the box, which on a pill radius would hang past the
        // fill at each end as a stray whisker.
        overflow: 'hidden',
        // `accentWash` rather than the accent, for the reason the weather chip
        // and the charging chip both give: it has to stay a background. The
        // reading is what is being read, and a saturated chip at the top of the
        // screen reads as an alert rather than as a readout.
        background: running ? color.accentWash : color.hover,
      }}
      // Ambient, like everything else on these two surfaces — nothing on screen
      // says this, and it is the whole of the mark for a screen reader, which
      // cannot see a ring at all.
      aria-label={`Timer ${running ? 'running' : 'paused'}, ${reading} remaining`}
      role="img"
    >
      <svg
        viewBox="0 0 24 24"
        width={size.glyph}
        height={size.glyph}
        style={{ flex: 'none', display: 'block' }}
      >
        {/* The track. Faint, and the whole circle, so the mark is a ring before
            any time has passed rather than an arc floating in nothing. */}
        <circle
          cx={RING.cx}
          cy={RING.cy}
          r={RING.r}
          fill="none"
          stroke={color.dividerStrong}
          strokeWidth={size.stroke}
        />

        {/* The fill. Rotated a quarter-turn back so it starts at twelve o'clock
            and runs clockwise, which is the direction every dial goes. */}
        <circle
          cx={RING.cx}
          cy={RING.cy}
          r={RING.r}
          fill="none"
          stroke={tint}
          strokeWidth={size.stroke}
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={CIRCUMFERENCE * (1 - progress)}
          style={{
            transformOrigin: '12px 12px',
            transform: 'rotate(-90deg)',
            // The same linear second the card's trace uses, and for the same
            // reason: `useTimer` samples once a second and this carries the
            // stroke smoothly between two samples. Off while paused, or resuming
            // would animate the ring from wherever it happened to be.
            transition: running ? 'stroke-dashoffset 1s linear' : 'none',
          }}
        />
      </svg>

      <span
        style={{
          fontSize: size.font,
          fontWeight: 600,
          letterSpacing: '.01em',
          color: tint,
          // Tabular and floored, as the charge and the temperature: a mark beside
          // a clock must not shuffle as 1:00 becomes 0:59.
          fontVariantNumeric: 'tabular-nums',
          minWidth: size.number,
          textAlign: 'right',
        }}
      >
        {reading}
      </span>
    </span>
  )
}
