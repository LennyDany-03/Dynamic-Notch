import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { apple } from '../tokens'

interface Props {
  isPlaying: boolean
  trackTitle?: string
  albumArt?: string
  notifCount: number
  activeModule: 'none' | 'music' | 'notif' | 'calendar' | 'settings'
  onClick: (e: React.MouseEvent) => void
}

function useClock() {
  const [time, setTime] = useState(() => {
    const now = new Date()
    return now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
  })
  useEffect(() => {
    const tick = () => {
      const now = new Date()
      setTime(now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }))
    }
    const ms = 1000 - new Date().getMilliseconds()
    const handle = setTimeout(() => {
      tick()
      const iv = setInterval(tick, 1000)
      // cleanup inner interval — returned from inner closure won't be auto-cleaned
      // so we store it on the outer handle to clear on unmount
      ;(handle as any)._iv = iv
    }, ms)
    return () => {
      clearTimeout(handle)
      if ((handle as any)._iv) clearInterval((handle as any)._iv)
    }
  }, [])
  return time
}

export default function IslandPill({
  isPlaying,
  trackTitle,
  albumArt,
  notifCount,
  onClick,
}: Props) {
  const time = useClock()
  const hasMusic = isPlaying && !!trackTitle

  // Width: wider when music is active to give all elements breathing room
  const pillWidth = hasMusic ? 240 : 180

  return (
    <motion.div
      onClick={onClick}
      animate={{ width: pillWidth }}
      transition={apple.spring.collapse}
      style={{
        display: 'flex',
        alignItems: 'center',
        background: apple.black,
        borderRadius: apple.pillRadius,
        cursor: 'pointer',
        userSelect: 'none',
        overflow: 'hidden',
        height: '36px',
        padding: '0 16px',
        gap: '0px',
        position: 'relative',
        width: pillWidth,
      }}
    >
      {/* Left: Album art thumbnail when music is playing */}
      <motion.div
        animate={{
          width: hasMusic ? 26 : 0,
          opacity: hasMusic ? 1 : 0,
          marginRight: hasMusic ? 10 : 0,
        }}
        transition={apple.spring.content}
        style={{
          height: '26px',
          borderRadius: apple.smallRadius,
          overflow: 'hidden',
          background: 'rgba(255,255,255,0.08)',
          flexShrink: 0,
        }}
      >
        {hasMusic && (
          albumArt ? (
            <img src={albumArt} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
          ) : (
            <div style={{
              width: '100%', height: '100%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={apple.text2} strokeWidth="2" strokeLinecap="round">
                <path d="M9 18V5l12-2v13" />
                <circle cx="6" cy="18" r="3" />
                <circle cx="18" cy="16" r="3" />
              </svg>
            </div>
          )
        )}
      </motion.div>

      {/* Center: Live clock — always shown */}
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <span style={{
          fontFamily: "'Inter', -apple-system, sans-serif",
          fontSize: '14px',
          fontWeight: 600,
          color: apple.text1,
          letterSpacing: '-0.02em',
          lineHeight: 1,
          whiteSpace: 'nowrap',
        }}>
          {time}
        </span>
      </div>

      {/* Right: Mini wave bars when playing, OR notification red dot */}
      <motion.div
        animate={{ opacity: 1 }}
        style={{ display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0 }}
      >
        {hasMusic && (
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '2px', height: '14px', marginLeft: '10px' }}>
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                style={{
                  width: '3px',
                  background: apple.green,
                  borderRadius: '1.5px',
                  transformOrigin: 'bottom',
                  animation: `waveBar 0.8s ease-in-out ${i * 0.12}s infinite`,
                  height: '100%',
                }}
              />
            ))}
          </div>
        )}

        {notifCount > 0 && !hasMusic && (
          <div style={{
            width: '7px',
            height: '7px',
            borderRadius: '50%',
            background: apple.red,
            flexShrink: 0,
            marginLeft: '8px',
          }} />
        )}
      </motion.div>
    </motion.div>
  )
}
