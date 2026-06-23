import { useRef } from 'react'
import { motion } from 'framer-motion'
import { apple } from '../tokens'

interface Track {
  title: string
  artist: string
  albumArt?: string
  progress: number
  duration: number
  isPlaying: boolean
}

interface Props {
  track: Track
  onPlayPause: () => void
  onNext: () => void
  onPrev: () => void
  onSeek: (pos: number) => void
}

function formatTime(ms: number) {
  if (!ms || ms < 0) return '0:00'
  const s = Math.floor(ms / 1000)
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${m}:${sec.toString().padStart(2, '0')}`
}

export default function MusicIsland({ track, onPlayPause, onNext, onPrev, onSeek }: Props) {
  const progressRatio = track.duration > 0 ? track.progress / track.duration : 0
  const barRef = useRef<HTMLDivElement>(null)

  const handleBarClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!barRef.current || track.duration <= 0) return
    const rect = barRef.current.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    onSeek(ratio * track.duration)
  }

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

      {/* Progress bar */}
      <div>
        <div
          ref={barRef}
          onClick={handleBarClick}
          style={{
            height: '4px',
            background: apple.fill2,
            borderRadius: '4px',
            cursor: 'pointer',
            position: 'relative',
          }}
        >
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              height: '100%',
              borderRadius: '4px',
              background: apple.text1,
              width: `${progressRatio * 100}%`,
              transition: 'width 0.25s linear',
            }}
          />
          {/* Scrubber thumb */}
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: `${progressRatio * 100}%`,
              transform: 'translate(-50%, -50%)',
              width: '12px',
              height: '12px',
              borderRadius: '50%',
              background: apple.text1,
              boxShadow: '0 0 0 2px rgba(255,255,255,0.15)',
            }}
          />
        </div>

        {/* Time labels */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginTop: '5px',
          fontFamily: "'Inter', -apple-system, sans-serif",
          fontSize: '10px',
          color: apple.text3,
          fontWeight: 500,
          letterSpacing: '-0.01em',
        }}>
          <span>{formatTime(track.progress)}</span>
          <span>-{formatTime(track.duration - track.progress)}</span>
        </div>
      </div>

      {/* Playback controls */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingBottom: '2px',
      }}>
        {/* Volume icon placeholder */}
        <button
          className="apple-active-feedback"
          style={{ color: apple.text2, display: 'flex', alignItems: 'center' }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" fillOpacity="0.3" />
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
            <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
          </svg>
        </button>

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

        {/* AirPlay / share icon placeholder */}
        <button
          className="apple-active-feedback"
          style={{ color: apple.text2, display: 'flex', alignItems: 'center' }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="m9 18 3 3 3-3" />
            <path d="M12 21V9" />
            <path d="M4.93 10.93A10 10 0 1 0 19.07 10.93" />
          </svg>
        </button>
      </div>
    </motion.div>
  )
}
