import { useState } from 'react'
import BatteryBadge from './system/BatteryBadge'
import TimerBadge from './timer/TimerBadge'
import WeatherBadge from './weather/WeatherBadge'
import { color, sectionLabel } from '../tokens'
import { MODULE_LABELS, type NotchModule } from '../types/notch'
import type { BatteryStatus } from '../types/system'
import { phaseOf, type TimerState } from '../types/timer'
import type { CurrentWeather } from '../types/weather'

/**
 * The chip the temperature is drawn on, and the one deviation in this file from
 * `BatteryBadge`'s rule that the strip gets a bare mark.
 *
 * That rule has a reason and it still holds for the charge: a 22px chip inside a
 * 26px strip reads as a button squeezed into a title bar. This is 18, which
 * leaves 4 above and below and reads as a tag rather than a control — and the
 * weather needs it where the charge does not, because a battery outline is
 * legible as a mark on any surface while a glyph beside a number is two unlike
 * things that need something to say they are one. The accent wash is that
 * something, and it is what the user asked the mark to be coloured with.
 *
 * Its height is also what selects the badge's compact size — see `WeatherBadge`.
 */
const CHIP = { height: 18, padding: '0 6px' } as const

interface Props {
  active: NotchModule
  onPrev: () => void
  onNext: () => void
  /**
   * The cards in the ring — the `panels` preference, resolved.
   *
   * Only its length is read now that there is no counter, and only to tell a
   * ring of one from a ring of several. It stays the resolved list rather than
   * `MODULES` because that distinction is exactly what the preference changes:
   * a user down to a single visible card has no arrows to draw.
   */
  modules: readonly NotchModule[]
  /** The charge, drawn in the corner of the strip. Null on a machine without one. */
  battery: BatteryStatus | null
  /**
   * The temperature, drawn in the *other* corner. Null until a place is set.
   *
   * The reading rather than the feed, as on the pill: a fetch that failed or is
   * in flight is the weather card's to explain, and this strip is on screen over
   * every other card in the ring.
   */
  weather: CurrentWeather | null
  /**
   * The countdown, which takes that same corner when there is one.
   *
   * The strip and the pill are the notch's two resting surfaces and they answer
   * the same questions, so they take the same priority — timer › music ›
   * weather, minus the music, which has a card of its own one arrow away and no
   * business in a 26px strip. One rule applied twice rather than a strip that
   * keeps showing the temperature while the pill has moved on.
   *
   * It matters more here than the arithmetic suggests: a card being open is
   * exactly when the pill is *not* on screen, so without this the countdown
   * would disappear for as long as the user was reading anything else.
   */
  timer: TimerState
  /** The clock, from `useTimer`. See `TimerFeed.now`. */
  now: number
}

/*
 * There is deliberately no position counter.
 *
 * The strip used to read "CALENDAR 2/5". It answered a question nobody was
 * asking — the chevrons already say there is more than one card, and *which
 * numbered slot* the calendar occupies is not a thing anyone navigates by; you
 * go left or right until you see the card you wanted. What it cost was real:
 * it sat inside the centred label, so the module name — the part actually being
 * read — was parked left of centre by half the counter's width and slid
 * sideways every time the ring stepped.
 *
 * Removing it is what lets the name simply be centred, with no reserved box or
 * mirror to keep in step.
 */

function Chevron({
  direction,
  label,
  onClick,
}: {
  direction: 'left' | 'right'
  label: string
  onClick: () => void
}) {
  const [hover, setHover] = useState(false)

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      onPointerEnter={() => setHover(true)}
      onPointerLeave={() => setHover(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 20,
        height: 20,
        padding: 0,
        flex: 'none',
        borderRadius: 6,
        // Accent only on the active state, per the design rules.
        background: hover ? color.hover : 'transparent',
        transition: 'background 140ms ease',
      }}
    >
      <svg
        viewBox="0 0 24 24"
        width={14}
        height={14}
        fill="none"
        stroke={hover ? color.accent : color.text.muted}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ transition: 'stroke 140ms ease' }}
      >
        {direction === 'left' ? <path d="m14 6-6 6 6 6" /> : <path d="m10 6 6 6-6 6" />}
      </svg>
    </button>
  )
}

/**
 * Top nav shared by every expanded module.
 *
 * Replaces the design export's dot row. Dots said nothing about which module you
 * were on, and at 4px tall they were effectively invisible — the other modules
 * were unreachable in practice. Arrows flanking the module name answer both
 * "where am I" and "how do I move".
 */
export default function NavArrows({
  active,
  onPrev,
  onNext,
  modules,
  battery,
  weather,
  timer,
  now,
}: Props) {
  const badge = battery !== null && battery.percent !== null
  const hasTimer = phaseOf(timer) !== 'idle'
  // The arrows say nothing useful with one card in the ring: there is nowhere to
  // go, and a pair of chevrons that return you to where you are is a control that
  // lies. The label keeps the centre either way, because the strip is a grid.
  const single = modules.length <= 1

  return (
    // Three columns, with the outer two an equal `1fr`.
    //
    // That equality is the whole point: whatever the badge turns out to measure,
    // the column holding it and the empty one opposite are the same width, so
    // the middle group lands on the card's centre line by construction. The
    // previous version mirrored a hand-kept `BADGE_WIDTH` on the left instead,
    // which had to be edited in step with the badge every time it changed and
    // was only ever as right as the last person to do the arithmetic.
    //
    // It also un-crowds the corner. In a flex row the badge was one more item
    // eight pixels from the chevron; here it sits at the end of its own column
    // with the leftover space between them, which is what a status mark in a
    // corner should look like.
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr auto 1fr',
        alignItems: 'center',
        width: '100%',
        padding: '0 12px',
      }}
    >
      {/* The temperature, in the corner the grid was already reserving.

          This column existed as an empty spacer whose only job was to be the
          same width as the badge's opposite it — so the mark costs no layout at
          all, and the module name stays on the card's centre line whether it is
          drawn or not. Left rather than right because the charge has the right,
          and the two readouts flanking the name is the nav strip arriving at the
          same arrangement as the pill it replaces on screen. */}
      <span style={{ display: 'flex', justifyContent: 'flex-start', minWidth: 0 }}>
        {hasTimer ? (
          <TimerBadge timer={timer} now={now} chip={CHIP} />
        ) : (
          <WeatherBadge current={weather} chip={CHIP} />
        )}
      </span>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
        {/* A spacer of the chevron's own size when there is nowhere to go, so the
            name stays on the centre line instead of sliding 20px left. */}
        {single ? (
          <span aria-hidden style={{ width: 20, flex: 'none' }} />
        ) : (
          <Chevron direction="left" label="Previous panel" onClick={onPrev} />
        )}

        <span
          style={{
            ...sectionLabel,
            minWidth: 0,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {MODULE_LABELS[active]}
        </span>

        {single ? (
          <span aria-hidden style={{ width: 20, flex: 'none' }} />
        ) : (
          <Chevron direction="right" label="Next panel" onClick={onNext} />
        )}
      </div>

      {/* Nothing at all on a machine without a battery, and the grid needs no
          telling — an empty column is still the same width as the one opposite,
          so the name does not move. */}
      <span style={{ display: 'flex', justifyContent: 'flex-end', minWidth: 0 }}>
        {badge && <BatteryBadge battery={battery} />}
      </span>
    </div>
  )
}
