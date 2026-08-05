import { color } from '../tokens'

/**
 * The 200×32 collapsed pill — state 01 in the design export.
 *
 * Placeholder for now: the equalizer animates unconditionally and the label is
 * static. It gets wired to the real media session in feature 2.
 */
export default function CollapsedPill() {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '0 14px',
      }}
    >
      {/* Equalizer — the one place accentBright is used. */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2.5, height: 13 }}>
        {[0, 0.2, 0.4].map((delay) => (
          <span
            key={delay}
            className="eq"
            style={{
              width: 2.5,
              height: 13,
              borderRadius: 2,
              background: color.accentBright,
              animationDelay: `${delay}s`,
            }}
          />
        ))}
      </div>

      <span
        style={{
          flex: 1,
          minWidth: 0,
          fontSize: 11,
          fontWeight: 500,
          color: color.text.secondary,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        Now playing
      </span>

      <span
        style={{
          flex: 'none',
          width: 6,
          height: 6,
          borderRadius: 99,
          background: color.accent,
        }}
      />
    </div>
  )
}
