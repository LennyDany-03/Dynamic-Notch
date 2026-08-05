import type { MediaSession } from '../hooks/useMediaSession'
import { color } from '../tokens'

/**
 * The 200×32 collapsed pill — design state 01.
 *
 * Shows the live track title rather than a static label; the equalizer only
 * animates while something is actually playing.
 */
export default function CollapsedPill({ session }: { session: MediaSession }) {
  const { media } = session
  const isPlaying = media?.isPlaying ?? false
  const label = media ? media.title || 'Now playing' : 'Nothing playing'

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
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2.5, height: 13, flex: 'none' }}>
        {[0, 0.2, 0.4].map((delay) => (
          <span
            key={delay}
            className={isPlaying ? 'eq' : undefined}
            style={{
              width: 2.5,
              height: 13,
              borderRadius: 2,
              background: color.accentBright,
              animationDelay: `${delay}s`,
              // Paused: bars rest low instead of freezing at a random phase.
              transform: isPlaying ? undefined : 'scaleY(0.3)',
              transformOrigin: 'bottom',
              opacity: media ? 1 : 0.35,
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
        {label}
      </span>

      <span
        style={{
          flex: 'none',
          width: 6,
          height: 6,
          borderRadius: 99,
          background: color.accent,
          opacity: isPlaying ? 1 : 0.35,
        }}
      />
    </div>
  )
}
