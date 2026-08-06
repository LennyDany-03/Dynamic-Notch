import { type ClipboardEntry, relativeTime } from '../../hooks/useClipboardHistory'
import { color } from '../../tokens'

function RowIcon({ kind }: { kind: ClipboardEntry['kind'] }) {
  const common = {
    viewBox: '0 0 24 24',
    width: 16,
    height: 16,
    fill: 'none',
    stroke: color.text.icon,
    strokeWidth: 1.5,
    strokeLinecap: 'round' as const,
    style: { flex: 'none' as const },
  }

  if (kind === 'link') {
    return (
      <svg {...common}>
        <path d="M9 15l6-6M10.5 6.5 12 5a3.5 3.5 0 0 1 5 5l-1.5 1.5M13.5 17.5 12 19a3.5 3.5 0 0 1-5-5l1.5-1.5" />
      </svg>
    )
  }
  return (
    <svg {...common}>
      <path d="M5 6h14M5 10h14M5 14h9M5 18h9" />
    </svg>
  )
}

interface Props {
  entries: ClipboardEntry[]
  loaded: boolean
  onCopy: (entry: ClipboardEntry) => void
}

/** Clipboard rows — hairline dividers, not cards, per the design. */
export default function ClipboardHistory({ entries, loaded, onCopy }: Props) {
  if (entries.length === 0) {
    return (
      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <span
          style={{
            fontSize: 11,
            color: color.text.muted,
            textAlign: 'center',
            lineHeight: 1.5,
            padding: '0 8px',
          }}
        >
          {loaded ? 'Nothing copied yet' : ''}
        </span>
      </div>
    )
  }

  return (
    <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
      {entries.map((entry, i) => (
        <button
          key={entry.id}
          type="button"
          title="Click to copy again"
          onClick={() => onCopy(entry)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 11,
            padding: '9px 2px',
            textAlign: 'left',
            flex: 'none',
            borderBottom: i === entries.length - 1 ? 'none' : `1px solid ${color.divider}`,
          }}
        >
          <RowIcon kind={entry.kind} />
          <span
            style={{
              flex: 1,
              minWidth: 0,
              fontSize: 12,
              color: color.text.strong,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {entry.text.replace(/\s+/g, ' ').trim()}
          </span>
          <span style={{ fontSize: 11, color: color.text.muted, flex: 'none' }}>
            {relativeTime(entry.copiedAt)}
          </span>
        </button>
      ))}
    </div>
  )
}
