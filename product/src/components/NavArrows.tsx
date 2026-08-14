import { useState } from 'react'
import BatteryBadge from './system/BatteryBadge'
import { color, sectionLabel } from '../tokens'
import { MODULE_LABELS, type NotchModule } from '../types/notch'
import type { BatteryStatus } from '../types/system'

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
export default function NavArrows({ active, onPrev, onNext, modules, battery }: Props) {
  const badge = battery !== null && battery.percent !== null
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
      <span aria-hidden />

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
