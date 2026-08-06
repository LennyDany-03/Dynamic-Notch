import ScrubBar from './ScrubBar'
import type { MediaSession } from '../../hooks/useMediaSession'
import { color, radius } from '../../tokens'

/** Design state 02 — now playing, scrub bar, transport. */
export default function MediaControls({ session }: { session: MediaSession }) {
  const { media, progressMs, loaded, playPause, next, previous, seek } = session

  if (!media) {
    return (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <span style={{ fontSize: 12, color: color.text.muted }}>
          {loaded ? 'Nothing playing' : ''}
        </span>
      </div>
    )
  }

  const isSpotify = media.sourceAppId.toLowerCase().includes('spotify')

  return (
    <div style={{ width: '100%', height: '100%', padding: '14px 16px', display: 'flex', gap: 14, color: color.text.strong }}>
      {/* Album art */}
      <div
        style={{
          position: 'relative',
          width: 64,
          height: 64,
          borderRadius: radius.tile,
          flex: 'none',
          overflow: 'hidden',
          background: color.artGradient,
          boxShadow: '0 4px 12px rgba(0,0,0,.45)',
        }}
      >
        {media.albumArtBase64 ? (
          <img
            src={`data:image/png;base64,${media.albumArtBase64}`}
            alt=""
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        ) : (
          <>
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background:
                  'radial-gradient(48px 48px at 32% 30%,rgba(255,255,255,.18),transparent 70%)',
              }}
            />
            <svg
              viewBox="0 0 24 24"
              width={20}
              height={20}
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
          </>
        )}
      </div>

      {/* Right column */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: color.text.strong,
                letterSpacing: '-.01em',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {media.title || 'Unknown title'}
            </div>
            <div
              style={{
                fontSize: 12,
                color: color.text.secondary,
                marginTop: 1,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {media.artist}
            </div>
          </div>

          {/* Source mark, monochrome. Generic glyph unless the app is recognised —
              stamping a Spotify logo on a browser session would be wrong. */}
          {isSpotify ? (
            <svg viewBox="0 0 24 24" width={16} height={16} style={{ flex: 'none', opacity: 0.6 }}>
              <circle cx="12" cy="12" r="11" fill="rgba(255,255,255,.9)" />
              <path
                d="M6.5 9.5c3.5-1 7.5-.7 10.5 1M7 12.5c3-.8 6-.5 8.5 1M7.5 15.3c2.4-.6 4.8-.4 6.8.9"
                stroke="#202020"
                strokeWidth={1.4}
                strokeLinecap="round"
                fill="none"
              />
            </svg>
          ) : (
            <svg
              viewBox="0 0 24 24"
              width={16}
              height={16}
              style={{ flex: 'none', opacity: 0.6 }}
              fill="none"
              stroke="rgba(255,255,255,.9)"
              strokeWidth={1.5}
            >
              <path d="M9 18V6l10-2v12" />
              <circle cx="6.5" cy="18" r="2.5" />
              <circle cx="16.5" cy="16" r="2.5" />
            </svg>
          )}
        </div>

        <ScrubBar progressMs={progressMs} durationMs={media.durationMs} onSeek={seek} />

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 20,
            marginTop: 6,
          }}
        >
          <button type="button" aria-label="Previous track" onClick={previous} style={{ display: 'flex', padding: 0 }}>
            <svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke={color.text.strong} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round">
              <path d="M18 6 8 12l10 6z" />
              <path d="M6 6v12" />
            </svg>
          </button>

          <button
            type="button"
            aria-label={media.isPlaying ? 'Pause' : 'Play'}
            onClick={playPause}
            style={{
              width: 36,
              height: 36,
              borderRadius: 99,
              background: color.accent,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flex: 'none',
              padding: 0,
            }}
          >
            {media.isPlaying ? (
              <svg viewBox="0 0 24 24" width={14} height={14} fill="#fff">
                <path d="M6 5h4v14H6zM14 5h4v14h-4z" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" width={14} height={14} fill="#fff">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>

          <button type="button" aria-label="Next track" onClick={next} style={{ display: 'flex', padding: 0 }}>
            <svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke={color.text.strong} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round">
              <path d="M6 6l10 6-10 6z" />
              <path d="M18 6v12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}
