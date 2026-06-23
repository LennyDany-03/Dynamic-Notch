import { tokens } from '../tokens'

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

export default function MusicModule({ track, onPlayPause, onNext, onPrev, onSeek }: Props) {
  const t = tokens
  const pct = track.duration > 0 ? (track.progress / track.duration) * 100 : 0

  const formatTime = (seconds: number) => {
    if (isNaN(seconds) || seconds < 0) return '00:00'
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
  }

  // Bouncing cyberpunk visualizer wave heights
  const waveHeights = [8, 18, 12, 22, 10, 16, 9, 14, 6, 12]

  return (
    <div style={{
      width: '100%',
      height: '148px',
      padding: '14px 18px',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      position: 'relative',
      overflow: 'hidden',
      boxSizing: 'border-box',
    }}>
      {/* Top light rim specular line */}
      <div style={{
        position: 'absolute',
        top: 0, left: 0, right: 0,
        height: '1px',
        background: 'linear-gradient(90deg, transparent, rgba(167,139,250,0.12), transparent)',
      }} />

      {/* Row 1: Album Art + Text Details + Tech Codec Badge */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '14px',
        width: '100%',
      }}>
        {/* Holographic Album Art Container */}
        <div style={{
          width: '56px',
          height: '56px',
          background: 'linear-gradient(135deg, #160730 0%, #0d041c 100%)',
          borderLeft: `2.5px solid ${t.colors.accentPurple}`,
          borderRight: '1px solid rgba(255,255,255,0.03)',
          borderTop: '1px solid rgba(255,255,255,0.03)',
          borderBottom: '1px solid rgba(255,255,255,0.03)',
          clipPath: t.clipPath.small,
          flexShrink: 0,
          position: 'relative',
          overflow: 'hidden',
          boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
        }}>
          {track.albumArt ? (
            <img src={track.albumArt} alt="album"
              style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <div style={{
              width: '100%', height: '100%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
                stroke="rgba(167,139,250,0.3)" strokeWidth="1.5" strokeLinecap="round">
                <path d="M9 18V5l12-2v13" />
                <circle cx="6" cy="18" r="3" />
                <circle cx="18" cy="16" r="3" />
              </svg>
            </div>
          )}
          {/* Animated Holographic Scanline Overlay */}
          {track.isPlaying && <div className="scanline-effect" />}
        </div>

        {/* Info + Codec details */}
        <div style={{
          flex: 1,
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: '2px',
        }}>
          {/* Decode Info */}
          <span style={{
            fontFamily: t.fonts.mono,
            fontSize: '8px',
            fontWeight: 500,
            color: t.colors.accentGreen,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            textShadow: t.glow.green,
            marginBottom: '1px',
          }}>AUDIO // ENGINE: {track.isPlaying ? 'DECODING_PCM_48K' : 'STANDBY'}</span>

          <span style={{
            fontFamily: t.fonts.sans,
            fontSize: '14px',
            fontWeight: 600,
            color: t.colors.textPrimary,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            letterSpacing: '-0.01em',
          }}>{track.title || 'Nothing playing'}</span>

          <span style={{
            fontFamily: t.fonts.sans,
            fontSize: '11.5px',
            color: t.colors.textSecondary,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}>{track.artist || '—'}</span>
        </div>
      </div>

      {/* Row 2: Progress Scrubber with Monospace Time labels */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        width: '100%',
        marginTop: '2px',
      }}>
        {/* Current Time */}
        <span style={{
          fontFamily: t.fonts.mono,
          fontSize: '9px',
          color: '#555570',
          width: '32px',
          textAlign: 'left',
          fontVariantNumeric: 'tabular-nums',
        }}>{formatTime(track.progress)}</span>

        {/* Track Progress Bar */}
        <div
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect()
            onSeek(((e.clientX - rect.left) / rect.width) * track.duration)
          }}
          style={{
            flex: 1,
            height: '2px',
            background: 'rgba(255,255,255,0.06)',
            cursor: 'pointer',
            position: 'relative',
          }}
        >
          {/* Filled Bar */}
          <div style={{
            width: `${pct}%`,
            height: '100%',
            background: t.colors.accentPurple,
            boxShadow: '0 0 6px rgba(167,139,250,0.6)',
          }} />
          {/* Cyberpunk Rectangular Scrubber Knob */}
          <div style={{
            position: 'absolute',
            left: `${pct}%`,
            top: '-3px',
            width: '4px',
            height: '8px',
            background: t.colors.accentPurple,
            boxShadow: `0 0 6px ${t.colors.accentPurple}`,
            transform: 'translateX(-50%)',
            transition: 'left 0.1s linear',
          }} />
        </div>

        {/* Total Duration */}
        <span style={{
          fontFamily: t.fonts.mono,
          fontSize: '9px',
          color: '#555570',
          width: '32px',
          textAlign: 'right',
          fontVariantNumeric: 'tabular-nums',
        }}>{formatTime(track.duration)}</span>
      </div>

      {/* Row 3: Visualizer Waveform + Cyberpunk Controls Center */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
        height: '28px',
      }}>
        {/* Left: Waveform visualizer */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '2.5px',
          height: '22px',
          width: '70px',
        }}>
          {waveHeights.map((h, i) => (
            <div key={i} style={{
              width: '2px',
              height: `${h}px`,
              background: t.colors.accentPurple,
              opacity: track.isPlaying ? 0.65 : 0.15,
              animation: track.isPlaying
                ? `waveAnim 1.2s ease-in-out ${i * 0.08}s infinite`
                : 'none',
              transition: 'all 0.3s ease',
            }} />
          ))}
        </div>

        {/* Center: Holographic Controls */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
        }}>
          {/* Previous Track button */}
          <button
            onClick={onPrev}
            style={{
              width: '28px',
              height: '28px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: t.colors.textSecondary,
              transition: 'color 0.2s',
              outline: 'none',
            }}
            onMouseEnter={(e) => e.currentTarget.style.color = '#fff'}
            onMouseLeave={(e) => e.currentTarget.style.color = t.colors.textSecondary}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <polygon points="19 20 9 12 19 4 19 20" fill="currentColor" fillOpacity="0.1" />
              <line x1="5" y1="19" x2="5" y2="5" />
            </svg>
          </button>

          {/* Play/Pause Button */}
          <button
            onClick={onPlayPause}
            style={{
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(167,139,250,0.06)',
              border: `1px solid rgba(167,139,250,0.25)`,
              clipPath: t.clipPath.button,
              color: t.colors.accentPurple,
              boxShadow: t.glow.purple,
              transition: 'all 0.2s',
              outline: 'none',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(167,139,250,0.14)'
              e.currentTarget.style.borderColor = 'rgba(167,139,250,0.45)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(167,139,250,0.06)'
              e.currentTarget.style.borderColor = 'rgba(167,139,250,0.25)'
            }}
          >
            {track.isPlaying ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <rect x="6" y="4" width="4" height="16" fill="currentColor" fillOpacity="0.1" />
                <rect x="14" y="4" width="4" height="16" fill="currentColor" fillOpacity="0.1" />
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <polygon points="6 3 20 12 6 21 6 3" fill="currentColor" fillOpacity="0.15" />
              </svg>
            )}
          </button>

          {/* Next Track button */}
          <button
            onClick={onNext}
            style={{
              width: '28px',
              height: '28px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: t.colors.textSecondary,
              transition: 'color 0.2s',
              outline: 'none',
            }}
            onMouseEnter={(e) => e.currentTarget.style.color = '#fff'}
            onMouseLeave={(e) => e.currentTarget.style.color = t.colors.textSecondary}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <polygon points="5 4 15 12 5 20 5 4" fill="currentColor" fillOpacity="0.1" />
              <line x1="19" y1="5" x2="19" y2="19" />
            </svg>
          </button>
        </div>

        {/* Right: Technical Mode details */}
        <span style={{
          fontFamily: t.fonts.mono,
          fontSize: '8px',
          color: '#3A3A52',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          width: '70px',
          textAlign: 'right',
        }}>MODE // STEREO</span>
      </div>
    </div>
  )
}
