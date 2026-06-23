import { useState, useEffect } from 'react'
import { tokens } from '../tokens'

interface Props {
  isPlaying: boolean
  notifCount: number
  eventCount: number
  trackTitle?: string
  trackArtist?: string
  onPlayPauseToggle: (e: React.MouseEvent) => void
  onOpenDashboard: (e: React.MouseEvent) => void
  onOpenAlerts: (e: React.MouseEvent) => void
}

export default function CollapsedNotch({
  isPlaying,
  onOpenDashboard
}: Props) {
  const t = tokens
  const [timeStr, setTimeStr] = useState('')

  // Live clock updates
  useEffect(() => {
    const updateTime = () => {
      const now = new Date()
      setTimeStr(now.toLocaleTimeString('en-US', {
        hour: '2-digit', minute: '2-digit', hour12: false
      }))
    }
    updateTime()
    const timer = setInterval(updateTime, 1000)
    return () => clearInterval(timer)
  }, [])

  // 8 bars for the right-aligned visualizer inside the playing collapsed notch
  const barHeights = [5, 12, 8, 15, 9, 13, 6, 10]

  return (
    <div
      onClick={onOpenDashboard}
      style={{
        width: isPlaying ? '180px' : '120px',
        height: '28px',
        background: t.colors.bgSurface,
        border: isPlaying ? '1px solid rgba(0, 240, 255, 0.3)' : `1px solid ${t.colors.borderDefault}`,
        clipPath: t.clipPath.default,
        display: 'flex',
        alignItems: 'center',
        justifyContent: isPlaying ? 'space-between' : 'center',
        padding: isPlaying ? '0 12px' : '0 10px',
        position: 'relative',
        boxShadow: isPlaying ? '0 0 10px rgba(0, 240, 255, 0.15)' : 'none',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        cursor: 'pointer',
      }}
    >
      {/* Left accent color beacon line */}
      <div style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: '1.5px',
        height: '100%',
        background: isPlaying ? '#00f0ff' : t.colors.accentPurple,
        boxShadow: isPlaying ? '0 0 6px #00f0ff' : t.glow.purple,
        opacity: 0.8,
        transition: 'background 0.3s',
      }} />

      {isPlaying ? (
        <>
          {/* Left: Time clock */}
          <span style={{
            fontFamily: t.fonts.mono,
            fontSize: '10px',
            fontWeight: 500,
            color: t.colors.textPrimary,
            letterSpacing: '0.05em',
          }}>
            {timeStr}
          </span>

          {/* Right: Bouncing Visualizer Rhythm Bars (Magenta & Cyan) */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '2px',
            height: '15px',
          }}>
            {barHeights.map((h, i) => {
              const barColor = i % 2 === 0 ? '#ff007f' : '#00f0ff'
              return (
                <div
                  key={i}
                  style={{
                    width: '2px',
                    height: `${h}px`,
                    background: barColor,
                    boxShadow: `0 0 3px ${barColor}40`,
                    animation: 'waveAnim 1s ease-in-out infinite',
                    animationDelay: `${i * 0.08}s`,
                    transformOrigin: 'bottom',
                  }}
                />
              )
            })}
          </div>
        </>
      ) : (
        // Center: Simple Clock Time in Standby
        <span style={{
          fontFamily: t.fonts.mono,
          fontSize: '11px',
          fontWeight: 500,
          color: t.colors.textPrimary,
          letterSpacing: '0.08em',
        }}>
          {timeStr}
        </span>
      )}
    </div>
  )
}
