import { tokens } from '../tokens'

interface Track {
  title: string;
  artist: string;
  albumArt?: string;
  progress: number;
  duration: number;
  isPlaying: boolean;
}

interface Props {
  track: Track
  onPlayPause: () => void
  onNext: () => void
  onPrev: () => void
  onSeek: (pos: number) => void
}

export default function MusicModule({ track, onPlayPause, onNext, onPrev }: Props) {
  const t = tokens

  // 20 bars for the large centered visualizer panel
  const barHeights = [10, 22, 14, 28, 12, 18, 8, 24, 16, 32, 15, 20, 10, 26, 12, 18, 8, 14, 6, 10]

  return (
    <div style={{
      width: '100%',
      height: '100%',
      padding: '12px 14px',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      position: 'relative',
      overflow: 'hidden',
      boxSizing: 'border-box',
    }}>
      {/* Upper specular reflection line */}
      <div style={{
        position: 'absolute',
        top: 0, left: 0, right: 0,
        height: '1px',
        background: 'linear-gradient(90deg, transparent, rgba(0, 240, 255, 0.15), transparent)',
      }} />

      {/* Row 1: Album Art + Details */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        width: '100%',
      }}>
        {/* Compact Cyberpunk Album Art Frame with Magenta Accent */}
        <div style={{
          width: '46px',
          height: '46px',
          background: 'linear-gradient(135deg, #1A051D 0%, #06020F 100%)',
          borderLeft: '2.5px solid #ff007f', // Hot Magenta left-border
          borderRight: '1px solid rgba(0, 240, 255, 0.12)',
          borderTop: '1px solid rgba(0, 240, 255, 0.12)',
          borderBottom: '1px solid rgba(0, 240, 255, 0.12)',
          clipPath: t.clipPath.small,
          flexShrink: 0,
          position: 'relative',
          overflow: 'hidden',
          boxShadow: '0 0 8px rgba(255, 0, 127, 0.12)',
        }}>
          {track.albumArt ? (
            <img src={track.albumArt} alt="album"
              style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <div style={{
              width: '100%', height: '100%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                stroke="#ff007f" strokeWidth="1.8" strokeLinecap="round">
                <path d="M9 18V5l12-2v13" />
                <circle cx="6" cy="18" r="3" />
                <circle cx="18" cy="16" r="3" />
              </svg>
            </div>
          )}
          {/* Neon corner dot flashing indicator */}
          <div style={{
            position: 'absolute',
            top: '2px',
            left: '2px',
            width: '3px',
            height: '3px',
            background: '#00f0ff',
            boxShadow: '0 0 4px #00f0ff',
          }} />
          {/* Animated Holographic Scanline Overlay */}
          {track.isPlaying && <div className="scanline-effect" />}
        </div>

        {/* Info Column */}
        <div style={{
          flex: 1,
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: '1px',
        }}>
          {/* Header Decoder Info */}
          <span style={{
            fontFamily: t.fonts.mono,
            fontSize: '7.5px',
            fontWeight: 600,
            color: '#00f0ff',
            letterSpacing: '0.08em',
            textShadow: '0 0 4px rgba(0, 240, 255, 0.3)',
          }}>{track.isPlaying ? 'RNDR_PCM' : 'STANDBY'}</span>

          <span style={{
            fontFamily: t.fonts.sans,
            fontSize: '11.5px',
            fontWeight: 600,
            color: t.colors.textPrimary,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            marginTop: '1px',
          }}>{track.title || 'Nothing playing'}</span>

          <span style={{
            fontFamily: t.fonts.mono,
            fontSize: '9px',
            color: '#00f0ff',
            opacity: 0.8,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}>{track.artist || '—'}</span>
        </div>
      </div>

      {/* Row 2: Holographic Equalizer Screen Viewport (Centered Visualizer) */}
      <div style={{
        width: '100%',
        height: '66px',
        background: 'rgba(0, 240, 255, 0.01)',
        border: '1px solid rgba(0, 240, 255, 0.08)',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '6px 8px',
        boxSizing: 'border-box',
        overflow: 'hidden',
      }}>
        {/* Holographic grid scanline effect inside the frame */}
        {track.isPlaying && <div className="scanline-effect" />}

        {/* Screen Status Info overlays */}
        <div style={{
          position: 'absolute',
          top: '3px',
          left: '6px',
          fontFamily: t.fonts.mono,
          fontSize: '6.5px',
          color: '#3A3A52',
          letterSpacing: '0.05em',
        }}>
          SYS_EQ // FFT_20
        </div>
        <div style={{
          position: 'absolute',
          top: '3px',
          right: '6px',
          fontFamily: t.fonts.mono,
          fontSize: '6.5px',
          color: track.isPlaying ? '#ff007f' : '#3A3A52',
          letterSpacing: '0.05em',
        }}>
          {track.isPlaying ? 'GAIN: -11.4dB' : 'STANDBY'}
        </div>

        {/* 20-bar visualizer centered */}
        <div style={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'center',
          gap: '2.5px',
          height: '36px',
          marginTop: '6px',
        }}>
          {barHeights.map((h, i) => {
            const barColor = i % 2 === 0 ? '#ff007f' : '#00f0ff'
            const anim = track.isPlaying
              ? `waveAnim 1s ease-in-out ${i * 0.05}s infinite`
              : 'none'
            return (
              <div
                key={i}
                style={{
                  width: '3.5px',
                  height: track.isPlaying ? `${h}px` : '4px',
                  background: track.isPlaying ? barColor : 'rgba(255, 255, 255, 0.06)',
                  boxShadow: track.isPlaying ? `0 0 5px ${barColor}60` : 'none',
                  animation: anim,
                  transformOrigin: 'bottom',
                  transition: 'all 0.25s ease',
                }}
              />
            )
          })}
        </div>
      </div>

      {/* Row 3: Playback Controls balanced by sub-row details */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
        height: '24px',
      }}>
        {/* Left: Codec diagnostic info */}
        <span style={{
          fontFamily: t.fonts.mono,
          fontSize: '7.5px',
          color: '#3A3A52',
          letterSpacing: '0.05em',
          width: '70px',
        }}>DECODER: PCM</span>

        {/* Center: Controls HUD Panel */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '3px',
        }}>
          {/* Previous Button */}
          <button
            onClick={onPrev}
            style={{
              width: '22px',
              height: '22px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#555570',
              transition: 'color 0.2s',
              outline: 'none',
            }}
            onMouseEnter={(e) => e.currentTarget.style.color = '#ff007f'}
            onMouseLeave={(e) => e.currentTarget.style.color = '#555570'}
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <polygon points="19 20 9 12 19 4 19 20" fill="currentColor" fillOpacity="0.1" />
              <line x1="5" y1="19" x2="5" y2="5" />
            </svg>
          </button>

          {/* Play/Pause Button with neon borders & no border radius */}
          <button
            onClick={onPlayPause}
            style={{
              width: '28px',
              height: '22px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(0, 240, 255, 0.05)',
              border: '1px solid rgba(0, 240, 255, 0.25)',
              clipPath: t.clipPath.button,
              color: '#00f0ff',
              boxShadow: '0 0 6px rgba(0, 240, 255, 0.15)',
              transition: 'all 0.2s',
              outline: 'none',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(0, 240, 255, 0.12)'
              e.currentTarget.style.borderColor = '#00f0ff'
              e.currentTarget.style.color = '#fff'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(0, 240, 255, 0.05)'
              e.currentTarget.style.borderColor = 'rgba(0, 240, 255, 0.25)'
              e.currentTarget.style.color = '#00f0ff'
            }}
          >
            {track.isPlaying ? (
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <rect x="6" y="4" width="3" height="16" fill="currentColor" fillOpacity="0.1" />
                <rect x="15" y="4" width="3" height="16" fill="currentColor" fillOpacity="0.1" />
              </svg>
            ) : (
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <polygon points="6 3 20 12 6 21 6 3" fill="currentColor" fillOpacity="0.15" />
              </svg>
            )}
          </button>

          {/* Next Button */}
          <button
            onClick={onNext}
            style={{
              width: '22px',
              height: '22px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#555570',
              transition: 'color 0.2s',
              outline: 'none',
            }}
            onMouseEnter={(e) => e.currentTarget.style.color = '#ff007f'}
            onMouseLeave={(e) => e.currentTarget.style.color = '#555570'}
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <polygon points="5 4 15 12 5 20 5 4" fill="currentColor" fillOpacity="0.1" />
              <line x1="19" y1="5" x2="19" y2="19" />
            </svg>
          </button>
        </div>

        {/* Right: Sound Channel Detail */}
        <span style={{
          fontFamily: t.fonts.mono,
          fontSize: '7.5px',
          color: '#3A3A52',
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
          width: '70px',
          textAlign: 'right',
        }}>STEREO</span>
      </div>
    </div>
  )
}
