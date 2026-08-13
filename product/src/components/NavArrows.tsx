import { useState } from 'react'
import BatteryBadge from './system/BatteryBadge'
import { color, sectionLabel } from '../tokens'
import { MODULES, type NotchModule } from '../types/notch'
import type { BatteryStatus } from '../types/system'

const LABELS: Record<NotchModule, string> = {
  media: 'Media controls',
  launcher: 'Launcher and clipboard',
  files: 'File shelf and notes',
  notifications: 'Notifications',
  system: 'System monitor',
}

interface Props {
  active: NotchModule
  onPrev: () => void
  onNext: () => void
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
export default function NavArrows({ active, onPrev, onNext, battery }: Props) {
  const position = MODULES.indexOf(active) + 1
  const badge = battery !== null && battery.percent !== null

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

      <Chevron direction="left" label="Previous panel" onClick={onPrev} />

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
        {LABELS[active]}
        <span style={{ color: color.text.muted, opacity: 0.6, marginLeft: 6 }}>
          {position}/{MODULES.length}
        </span>
      </span>

      <Chevron direction="right" label="Next panel" onClick={onNext} />

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
