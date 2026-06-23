import { tokens } from '../tokens'

interface Props {
  isPlaying: boolean
  notifCount: number
  eventCount: number
}

export default function CollapsedNotch({ isPlaying, notifCount, eventCount }: Props) {
  const t = tokens

  return (
    <div style={{
      width: '280px',
      height: '28px',
      background: t.colors.bgSurface,
      border: `1px solid ${t.colors.borderDefault}`,
      clipPath: t.clipPath.default,
      display: 'flex',
      alignItems: 'center',
      padding: '0 14px',
      gap: '8px',
      position: 'relative',
    }}>
      {/* Left accent glow line */}
      <div style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: '1px',
        height: '100%',
        background: t.colors.accentPurple,
        boxShadow: t.glow.purple,
        opacity: 0.6,
      }} />

      {/* Diamond + LIVE */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
        <div style={{
          width: '5px', height: '5px',
          background: t.colors.accentPurple,
          boxShadow: t.glow.purple,
          transform: 'rotate(45deg)',
        }} />
        <span style={{
          fontFamily: t.fonts.sans,
          fontSize: '9px',
          fontWeight: 600,
          color: t.colors.textSecondary,
          letterSpacing: '0.1em',
        }}>LIVE</span>
      </div>

      {/* Separator */}
      <div style={{ width: '1px', height: '14px', background: t.colors.divider }} />

      {/* Music icon with playing indicator */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
          stroke={isPlaying ? t.colors.accentPurple : 'rgba(167,139,250,0.4)'}
          strokeWidth="1.8" strokeLinecap="round">
          <path d="M9 18V5l12-2v13"/>
          <circle cx="6" cy="18" r="3"/>
          <circle cx="18" cy="16" r="3"/>
        </svg>
      </div>

      {/* Separator */}
      <div style={{ width: '1px', height: '14px', background: t.colors.divider }} />

      {/* Notif dot */}
      {notifCount > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <div style={{
            width: '4px', height: '4px',
            background: t.colors.accentOrange,
            boxShadow: t.glow.orange,
          }} />
          <span style={{
            fontFamily: t.fonts.mono,
            fontSize: '9px',
            color: t.colors.textMuted,
          }}>{notifCount}</span>
        </div>
      )}

      {/* Separator */}
      <div style={{ width: '1px', height: '14px', background: t.colors.divider }} />

      {/* Calendar icon */}
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
        stroke="rgba(96,165,250,0.6)" strokeWidth="1.8" strokeLinecap="round">
        <rect x="3" y="4" width="18" height="18" rx="0"/>
        <line x1="16" y1="2" x2="16" y2="6"/>
        <line x1="8" y1="2" x2="8" y2="6"/>
        <line x1="3" y1="10" x2="21" y2="10"/>
      </svg>

      {/* Separator */}
      <div style={{ width: '1px', height: '14px', background: t.colors.divider }} />

      {/* Clock */}
      <span style={{
        fontFamily: t.fonts.mono,
        fontSize: '11px',
        color: '#6B6B88',
        marginLeft: 'auto',
      }}>
        {new Date().toLocaleTimeString('en-US', {
          hour: '2-digit', minute: '2-digit', hour12: false
        })}
      </span>
    </div>
  )
}
