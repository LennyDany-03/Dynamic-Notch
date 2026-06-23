import { motion } from 'framer-motion'
import { apple } from '../tokens'

interface Notif {
  id: string
  app: string
  message: string
  time: string
  unread: boolean
}

interface Props {
  notifications: Notif[]
  onDismiss: (id: string) => void
}

const APP_COLORS: Record<string, string> = {
  Gmail: apple.blue,
  WhatsApp: apple.green,
  System: apple.orange,
}

export default function NotifIsland({ notifications, onDismiss }: Props) {
  const isEmpty = notifications.length === 0

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.94 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.94 }}
      transition={apple.spring.expand}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '0px',
        padding: '12px 0 8px 0',
        width: '100%',
      }}
    >
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '0 16px 10px 16px',
      }}>
        <span style={{
          fontFamily: "'Inter', -apple-system, sans-serif",
          fontSize: '15px',
          fontWeight: 600,
          color: apple.text1,
          letterSpacing: '-0.02em',
        }}>
          Notifications
        </span>
        {notifications.filter(n => n.unread).length > 0 && (
          <span style={{
            fontFamily: "'Inter', -apple-system, sans-serif",
            fontSize: '11px',
            color: apple.blue,
            fontWeight: 500,
          }}>
            {notifications.filter(n => n.unread).length} new
          </span>
        )}
      </div>

      {/* Notification list */}
      {isEmpty ? (
        <div style={{
          padding: '24px 16px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '8px',
          color: apple.text3,
        }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
          <span style={{ fontFamily: "'Inter', sans-serif", fontSize: '12px' }}>
            No notifications
          </span>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', maxHeight: '200px', overflowY: 'auto' }}>
          {notifications.slice(0, 5).map((n, idx) => {
            const color = APP_COLORS[n.app] || apple.purple
            return (
              <motion.div
                key={n.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.06, ...apple.spring.content }}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '10px',
                  padding: '8px 16px',
                  borderBottom: idx < notifications.length - 1 ? `1px solid ${apple.sep}` : 'none',
                  cursor: 'default',
                }}
              >
                {/* App color dot */}
                <div style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: n.unread ? color : apple.fill2,
                  flexShrink: 0,
                  marginTop: '4px',
                }} />

                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginBottom: '2px',
                  }}>
                    <span style={{
                      fontFamily: "'Inter', sans-serif",
                      fontSize: '11px',
                      fontWeight: 600,
                      color: color,
                    }}>
                      {n.app}
                    </span>
                    <span style={{
                      fontFamily: "'Inter', sans-serif",
                      fontSize: '10px',
                      color: apple.text3,
                    }}>
                      {n.time}
                    </span>
                  </div>
                  <div style={{
                    fontFamily: "'Inter', sans-serif",
                    fontSize: '12px',
                    color: n.unread ? apple.text1 : apple.text2,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}>
                    {n.message}
                  </div>
                </div>

                {/* Dismiss button */}
                <button
                  className="apple-active-feedback"
                  onClick={() => onDismiss(n.id)}
                  style={{
                    color: apple.text3,
                    width: '16px',
                    height: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    marginTop: '2px',
                  }}
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </motion.div>
            )
          })}
        </div>
      )}
    </motion.div>
  )
}
