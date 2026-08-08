import type { MediaInfo } from '../../types/media'
import { color, radius } from '../../tokens'

/**
 * The now-playing banner — what the notch shows for the few seconds after music
 * starts.
 *
 * A report, not a player: art, title, artist, and a mark that says it is
 * playing. Deliberately none of the media card's transport, scrub bar, or nav —
 * there is no time to aim at a 36px button on a surface that leaves in two
 * seconds, and controls on it would make every track change look like the app
 * opening itself. Hovering dwells through to the real card, which is where the
 * controls are.
 */
export default function MediaAnnounce({ media }: { media: MediaInfo | null }) {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        padding: '0 14px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        color: color.text.strong,
      }}
    >
      {/* Album art. Same treatment as the media card, at banner scale. */}
      <div
        style={{
          position: 'relative',
          width: 44,
          height: 44,
          borderRadius: radius.small,
          flex: 'none',
          overflow: 'hidden',
          background: color.artGradient,
          boxShadow: '0 4px 12px rgba(0,0,0,.45)',
        }}
      >
        {media?.albumArtBase64 ? (
          <img
            src={`data:image/png;base64,${media.albumArtBase64}`}
            alt=""
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        ) : (
          <svg
            viewBox="0 0 24 24"
            width={16}
            height={16}
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              transform: 'translate(-50%,-50%)',
              opacity: 0.55,
            }}
            fill="none"
            stroke="#fff"
            strokeWidth={1.5}
          >
            <path d="M9 18V6l10-2v12" />
            <circle cx="6.5" cy="18" r="2.5" />
            <circle cx="16.5" cy="16" r="2.5" />
          </svg>
        )}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        {/* The label carries the "why am I seeing this" that a banner needs and a
            card the user opened does not. */}
        <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: '.14em', textTransform: 'uppercase', color: color.text.muted }}>
          Now playing
        </div>
        <div
          style={{
            fontSize: 13,
            fontWeight: 600,
            letterSpacing: '-.01em',
            marginTop: 1,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {media?.title || 'Unknown title'}
        </div>
        <div
          style={{
            fontSize: 11,
            color: color.text.secondary,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {media?.artist}
        </div>
      </div>

      {/* Same equalizer as the pill, so the two resting surfaces read as one
          overlay rather than two designs. */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2.5, height: 13, flex: 'none' }}>
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
              transformOrigin: 'bottom',
            }}
          />
        ))}
      </div>
    </div>
  )
}
