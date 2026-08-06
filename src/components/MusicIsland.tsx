import { motion } from 'framer-motion'
import { apple } from '../tokens'

interface Track {
  title: string
  artist: string
  albumArt?: string
  isPlaying: boolean
}

interface Props {
  track: Track
  onPlayPause: () => void
  onNext: () => void
  onPrev: () => void
}

export default function MusicIsland({ track, onPlayPause, onNext, onPrev }: Props) {

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.94 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.94 }}
      transition={apple.spring.expand}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '14px',
        padding: '16px',
        width: '100%',
      }}
    >
      {/* Top Row: Album art + Track info */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {/* Album Art — rounded square, Apple-style */}
        <div style={{
          width: '60px',
          height: '60px',
          borderRadius: apple.innerRadius,
          overflow: 'hidden',
          background: 'rgba(255,255,255,0.08)',
          flexShrink: 0,
          boxShadow: '0 4px 24px rgba(0,0,0,0.6)',
        }}>
          {track.albumArt ? (
            <img src={track.albumArt} alt="album"
              style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <div style={{
              width: '100%', height: '100%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'linear-gradient(135deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))',
            }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
                stroke={apple.text3} strokeWidth="1.8" strokeLinecap="round">
                <path d="M9 18V5l12-2v13" />
                <circle cx="6" cy="18" r="3" />
                <circle cx="18" cy="16" r="3" />
              </svg>
            </div>
          )}
        </div>

        {/* Track info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontFamily: "'Inter', -apple-system, sans-serif",
            fontSize: '13px',
            fontWeight: 600,
            color: apple.text1,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            letterSpacing: '-0.01em',
          }}>
            {track.title || 'Nothing Playing'}
          </div>
          <div style={{
            fontFamily: "'Inter', -apple-system, sans-serif",
            fontSize: '11px',
            color: apple.text2,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            marginTop: '2px',
          }}>
            {track.artist || '—'}
          </div>
        </div>

        {/* Live Waveform bars (Apple-style green) */}
        <div style={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: '2px',
          height: '20px',
          flexShrink: 0,
        }}>
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              style={{
                width: '3px',
                borderRadius: '1.5px',
                background: track.isPlaying ? apple.green : apple.fill3,
                transformOrigin: 'bottom',
                animation: track.isPlaying
                  ? `waveBar 0.75s ease-in-out ${i * 0.12}s infinite`
                  : 'none',
                height: track.isPlaying ? '100%' : '30%',
                transition: 'height 0.3s ease, background 0.3s ease',
              }}
            />
          ))}
        </div>
      </div>

      {/* Playback controls */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '24px',
        paddingBottom: '2px',
      }}>
        {/* Prev */}
        <button
          className="apple-active-feedback"
          onClick={onPrev}
          style={{ color: apple.text1, display: 'flex', alignItems: 'center' }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 20 9 12l10-8v16z" opacity="0.9" />
            <rect x="5" y="4" width="3" height="16" rx="1" />
          </svg>
        </button>

        {/* Play / Pause — the big center button */}
        <button
          className="apple-active-feedback"
          onClick={onPlayPause}
          style={{
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            background: apple.text1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: apple.black,
            flexShrink: 0,
          }}
        >
          {track.isPlaying ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="4" width="4" height="16" rx="1" />
              <rect x="14" y="4" width="4" height="16" rx="1" />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
          )}
        </button>

        {/* Next */}
        <button
          className="apple-active-feedback"
          onClick={onNext}
          style={{ color: apple.text1, display: 'flex', alignItems: 'center' }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
            <path d="M5 4l10 8-10 8V4z" opacity="0.9" />
            <rect x="16" y="4" width="3" height="16" rx="1" />
          </svg>
        </button>
      </div>
    </motion.div>
  )
}
