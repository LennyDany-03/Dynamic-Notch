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
   * The cards in the ring, in order — the `panels` preference, resolved. The
   * counter reads against this rather than against every module that exists, so
   * a user who keeps three of the seven sees "2/3" and not "4/7".
   */
  modules: readonly NotchModule[]
  /** The charge, drawn in the corner of the strip. Null on a machine without one. */
  battery: BatteryStatus | null
}

/**
 * Width of the badge, mirrored on the other side of the strip.
 *
 * The chevrons have to stay symmetric about the card's centre — they are the one
 * pair of controls that says "these do the same thing in opposite directions",
 * and 40px of drift makes them read as unrelated buttons. Hanging the badge off
 * the end and mirroring its width on the left keeps them where they were and puts
 * the badge in the corner, which is where a status mark belongs.
 *
 * Must cover the badge at its widest: an 18px glyph, a 4px gap and the 26px the
 * percentage is floored to.
 */
const BADGE_WIDTH = 48

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
        background: hover ? 'rgba(255,255,255,.06)' : 'transparent',
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
  const position = modules.indexOf(active) + 1
  const badge = battery !== null && battery.percent !== null
  // The arrows say nothing useful with one card in the ring: there is nowhere to
  // go, and a pair of chevrons that return you to where you are is a control that
  // lies. The label keeps the centre either way, because the strip is a grid.
  const single = modules.length <= 1

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
        padding: '0 12px',
        gap: 8,
      }}
    >
      {/* The badge's mirror. Nothing is drawn in it — it exists so the chevrons
          sit either side of the card's centre rather than either side of the
          space left over once the badge has taken its corner. */}
      {badge && <span aria-hidden style={{ width: BADGE_WIDTH, flex: 'none' }} />}

      {/* A spacer of the chevron's own size when there is nowhere to go, so the
          label stays on the card's centre line instead of sliding 20px left. */}
      {single ? (
        <span aria-hidden style={{ width: 20, flex: 'none' }} />
      ) : (
        <Chevron direction="left" label="Previous panel" onClick={onPrev} />
      )}

      <span
        style={{
          ...sectionLabel,
          flex: 1,
          minWidth: 0,
          textAlign: 'center',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {MODULE_LABELS[active]}
        {!single && (
          <span style={{ color: color.text.muted, opacity: 0.6, marginLeft: 6 }}>
            {position}/{modules.length}
          </span>
        )}
      </span>

      {single ? (
        <span aria-hidden style={{ width: 20, flex: 'none' }} />
      ) : (
        <Chevron direction="right" label="Next panel" onClick={onNext} />
      )}

      {badge && (
        <span
          style={{
            width: BADGE_WIDTH,
            flex: 'none',
            display: 'flex',
            justifyContent: 'flex-end',
          }}
        >
          <BatteryBadge battery={battery} />
        </span>
      )}
    </div>
  )
}
