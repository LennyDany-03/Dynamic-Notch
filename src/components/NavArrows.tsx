import { useState } from 'react'
import { color, sectionLabel } from '../tokens'
import { MODULES, type NotchModule } from '../types/notch'

const LABELS: Record<NotchModule, string> = {
  media: 'Media controls',
  launcher: 'Launcher and clipboard',
  files: 'File shelf and notes',
}

interface Props {
  active: NotchModule
  onPrev: () => void
  onNext: () => void
}

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
export default function NavArrows({ active, onPrev, onNext }: Props) {
  const position = MODULES.indexOf(active) + 1

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
    </div>
  )
}
