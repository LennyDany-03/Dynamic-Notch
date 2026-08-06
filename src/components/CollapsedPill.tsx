import { formatClock, useClock } from '../hooks/useClock'
import type { MediaSession } from '../hooks/useMediaSession'
import { color } from '../tokens'

/**
 * The 200×32 collapsed pill — design state 01.
 *
 * The clock is the pill's content; music is reduced to two ambient signals
 * flanking it. It previously showed the track title, which meant the resting
 * state of the whole overlay was only useful when something was playing.
 */
export default function CollapsedPill({ session }: { session: MediaSession }) {
  const { media } = session
  const isPlaying = media?.isPlaying ?? false
  const now = useClock()

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
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

      {/*
        Centred against the pill itself rather than the gap between the two
        marks, which differ in width — laying it out in flow would sit it a few
        pixels off centre. Not a hit target, so it stays out of the way of one.
      */}
      <span
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          textAlign: 'center',
          pointerEvents: 'none',
          fontSize: 12,
          fontWeight: 600,
          color: color.text.strong,
          // Stops the pill twitching as digits change width.
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {formatClock(now)}
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
