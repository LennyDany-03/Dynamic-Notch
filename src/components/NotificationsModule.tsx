import { tokens } from '../tokens'

export interface Notification {
  id: string
  app: string
  message: string
  time: string
  unread: boolean
}

const SOURCE_COLORS: Record<string, string> = {
  Gmail:    '#60A5FA',
  WhatsApp: '#4ADE80',
  System:   '#FB923C',
}

const getSourceColor = (app: string) => {
  return SOURCE_COLORS[app] || '#A78BFA'
}

const SOURCE_ICONS: Record<string, (color: string) => React.ReactNode> = {
  Gmail: (color: string) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth="1.8" strokeLinecap="round">
      <rect x="2" y="4" width="20" height="16"/>
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
    </svg>
  ),
  WhatsApp: (color: string) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth="1.8" strokeLinecap="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </svg>
  ),
  System: (color: string) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth="1.8" strokeLinecap="round">
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
      <line x1="12" y1="9" x2="12" y2="13"/>
      <line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>
  ),
}

const getSourceIcon = (app: string, color: string) => {
  const iconFn = SOURCE_ICONS[app]
  if (iconFn) return iconFn(color)
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth="1.8" strokeLinecap="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
      <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
    </svg>
  )
}

interface Props {
  notifications: Notification[]
  onDismiss: (id: string) => void
  onClearAll: () => void
}

export default function NotificationsModule({ notifications, onDismiss, onClearAll }: Props) {
  const t = tokens

  return (
    <div style={{
      width: '100%',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        height: '28px',
        display: 'flex', alignItems: 'center',
        padding: '0 14px',
        justifyContent: 'space-between',
        background: 'rgba(255,255,255,0.02)',
        borderBottom: `1px solid ${t.colors.divider}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{
            width: '6px', height: '6px',
            background: t.colors.accentPurple,
            boxShadow: t.glow.purple,
            transform: 'rotate(45deg)',
          }} />
          <span style={{
            fontFamily: t.fonts.sans,
            fontSize: '9px', fontWeight: 600,
            color: t.colors.textSecondary,
            letterSpacing: '0.1em',
          }}>ALERTS</span>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {notifications.length > 0 && (
            <button
              onClick={onClearAll}
              style={{
                background: 'transparent',
                border: 'none',
                fontFamily: t.fonts.sans,
                fontSize: '9px',
                fontWeight: 600,
                color: t.colors.textMuted,
                cursor: 'pointer',
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
                padding: '2px 6px',
                outline: 'none',
                transition: 'color 0.2s',
              }}
              onMouseEnter={(e) => e.currentTarget.style.color = t.colors.accentRed}
              onMouseLeave={(e) => e.currentTarget.style.color = t.colors.textMuted}
            >
              CLEAR ALL
            </button>
          )}
          <div style={{
            background: 'rgba(248,113,113,0.1)',
            border: '1px solid rgba(248,113,113,0.25)',
            padding: '2px 7px',
          }}>
            <span style={{
              fontFamily: t.fonts.mono,
              fontSize: '9px',
              color: t.colors.accentRed,
            }}>{notifications.length} NEW</span>
          </div>
        </div>
      </div>

      {/* Notification rows */}
      <div style={{ maxHeight: '208px', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        {notifications.length > 0 ? (
          notifications.map((notif, i) => {
            const color = getSourceColor(notif.app)
            return (
              <div key={notif.id}
                onMouseEnter={(e) => {
                  const btn = e.currentTarget.querySelector('.dismiss-btn') as HTMLElement
                  if (btn) btn.style.opacity = '1'
                  const ts = e.currentTarget.querySelector('.timestamp-container') as HTMLElement
                  if (ts) ts.style.opacity = '0'
                }}
                onMouseLeave={(e) => {
                  const btn = e.currentTarget.querySelector('.dismiss-btn') as HTMLElement
                  if (btn) btn.style.opacity = '0'
                  const ts = e.currentTarget.querySelector('.timestamp-container') as HTMLElement
                  if (ts) ts.style.opacity = '1'
                }}
                style={{
                  height: '52px',
                  display: 'flex', alignItems: 'stretch',
                  borderBottom: i < notifications.length - 1
                    ? `1px solid rgba(255,255,255,0.04)` : 'none',
                  position: 'relative',
                }}
              >
                {/* Source stripe */}
                <div style={{
                  width: '2px', flexShrink: 0,
                  background: color,
                  boxShadow: `0 0 6px ${color}60`,
                }} />

                {/* App icon */}
                <div style={{
                  width: '36px', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <div style={{
                    width: '32px', height: '32px',
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.05)',
                    clipPath: t.clipPath.small,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {getSourceIcon(notif.app, color)}
                  </div>
                </div>

                {/* Content */}
                <div style={{
                  flex: 1, minWidth: 0,
                  display: 'flex', flexDirection: 'column',
                  justifyContent: 'center',
                  padding: '0 10px',
                  gap: '2px',
                }}>
                  <span style={{
                    fontFamily: t.fonts.sans,
                    fontSize: '9px', fontWeight: 600,
                    color: '#4A4A62',
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                  }}>{notif.app}</span>
                  <span style={{
                    fontFamily: t.fonts.sans,
                    fontSize: '12px',
                    color: '#9999B0',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>{notif.message}</span>
                </div>

                {/* Timestamp + dot */}
                <div
                  className="timestamp-container"
                  style={{
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'flex-end', justifyContent: 'center',
                    padding: '0 14px', gap: '6px', flexShrink: 0,
                    transition: 'opacity 0.15s',
                  }}
                >
                  <span style={{
                    fontFamily: t.fonts.mono,
                    fontSize: '10px', color: '#3A3A52',
                  }}>{notif.time}</span>
                  {notif.unread && (
                    <div style={{
                      width: '4px', height: '4px',
                      background: color,
                      boxShadow: `0 0 6px ${color}`,
                    }} />
                  )}
                </div>

                {/* Dismiss button */}
                <button
                  className="dismiss-btn"
                  onClick={() => onDismiss(notif.id)}
                  style={{
                    position: 'absolute',
                    right: '8px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'transparent',
                    border: 'none',
                    color: t.colors.textMuted,
                    cursor: 'pointer',
                    opacity: 0,
                    transition: 'opacity 0.15s, color 0.15s',
                    padding: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.color = t.colors.accentRed}
                  onMouseLeave={(e) => e.currentTarget.style.color = t.colors.textMuted}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>
            )
          })
        ) : (
          <div style={{
            height: '52px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: t.fonts.sans,
            fontSize: '10px',
            color: t.colors.textMuted,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
          }}>
            No Active Alerts
          </div>
        )}
      </div>
    </div>
  )
}
