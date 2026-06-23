import { useState, useRef, useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useHotzone } from '../hooks/useHotzone'
import { useMediaSession } from '../hooks/useMediaSession'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { win11 as w } from '../tokens'
import { TemplateSwitcherPanel } from './AppleNotch'

type Module = 'none' | 'music' | 'notif' | 'calendar' | 'settings'
type Template = 'cyberpunk' | 'apple' | 'glass' | 'win11'

interface Props {
  currentTemplate: Template
  onSwitchTemplate: (t: Template) => void
}

interface Notif {
  id: string
  app: string
  message: string
  time: string
  unread: boolean
}

const MOCK_NOTIFS: Notif[] = [
  { id: '1', app: 'Gmail', message: 'Gowtham: Hey can you push the HRMS build today?', time: '2m', unread: true },
  { id: '2', app: 'WhatsApp', message: 'Nandha Kumar: Great work on the recruitment module!', time: '15m', unread: true },
  { id: '3', app: 'System', message: 'AWS S3 storage at 78% capacity', time: '1h', unread: false },
]

const EVENT_DAYS: Record<number, string> = { 24: w.accent, 25: '#FB923C', 26: '#4ADE80', 30: '#A78BFA' }
const DAY_NAMES = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

const isTauri = typeof window !== 'undefined' && !!(window as any).__TAURI_INTERNALS__
const CONTENT_MODULES: Module[] = ['music', 'notif', 'calendar']

// Mica/acrylic surface — very translucent, shows desktop through
const mica: React.CSSProperties = {
  background: w.bg,
  backdropFilter: w.blur,
  WebkitBackdropFilter: w.blur,
  borderLeft:   `1px solid ${w.border}`,
  borderRight:  `1px solid ${w.border}`,
  borderBottom: `1px solid ${w.border}`,
  borderTop:    `1px solid ${w.borderTop}`,
}

const WAVE_HEIGHTS = [3, 5, 4, 7, 5, 6, 4, 5, 3]

const toastVariants = {
  initial: { y: -24, opacity: 0, scale: 0.92 },
  animate: { y: 0, opacity: 1, scale: 1, transition: { type: 'spring' as const, stiffness: 420, damping: 28, mass: 0.9 } },
  exit: { y: -16, opacity: 0, scale: 0.92, transition: { type: 'tween' as const, ease: 'easeIn' as const, duration: 0.1 } },
}

const APP_TOAST_COLORS: Record<string, string> = {
  Gmail: w.accent,
  WhatsApp: '#4ADE80',
  System: '#FB923C',
}

function Win11Calendar() {
  const now = new Date()
  const [current, setCurrent] = useState(new Date(now.getFullYear(), now.getMonth(), 1))
  const year = current.getFullYear()
  const month = current.getMonth()
  const today = now.getDate()
  const isCurrentMonth = month === now.getMonth() && year === now.getFullYear()
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const monthName = current.toLocaleString('en-US', { month: 'long', year: 'numeric' })
  const cells: (number | null)[] = []
  for (let i = 0; i < firstDay; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  return (
    <div style={{ padding: '12px 14px 16px' }}>
      {/* Month nav */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <button
          onClick={() => setCurrent(new Date(year, month - 1, 1))}
          style={{
            width: '28px', height: '28px', borderRadius: '6px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: w.bgCard, border: `1px solid ${w.border}`,
            color: w.text2, cursor: 'pointer', transition: 'background 0.15s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = w.bgHover }}
          onMouseLeave={(e) => { e.currentTarget.style.background = w.bgCard }}
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>

        <span style={{
          fontFamily: w.font, fontSize: '13px', fontWeight: 600,
          color: w.text1, letterSpacing: '-0.01em',
        }}>
          {monthName}
        </span>

        <button
          onClick={() => setCurrent(new Date(year, month + 1, 1))}
          style={{
            width: '28px', height: '28px', borderRadius: '6px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: w.bgCard, border: `1px solid ${w.border}`,
            color: w.text2, cursor: 'pointer', transition: 'background 0.15s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = w.bgHover }}
          onMouseLeave={(e) => { e.currentTarget.style.background = w.bgCard }}
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>

      {/* Day headers */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px', marginBottom: '4px' }}>
        {DAY_NAMES.map(d => (
          <div key={d} style={{
            textAlign: 'center',
            fontFamily: w.font, fontSize: '9px', fontWeight: 600,
            color: w.text3, letterSpacing: '0.04em',
            paddingBottom: '4px',
          }}>
            {d}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px' }}>
        {cells.map((day, idx) => {
          const isToday = isCurrentMonth && day === today
          const dotColor = day !== null ? EVENT_DAYS[day] : undefined
          const isEmpty = day === null
          return (
            <div
              key={idx}
              style={{
                position: 'relative',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                aspectRatio: '1',
                borderRadius: '6px',
                background: isToday ? w.today : 'transparent',
                boxShadow: isToday ? `0 2px 12px ${w.accentGlow}` : 'none',
                fontFamily: w.font,
                fontSize: '11px',
                fontWeight: isToday ? 600 : 400,
                color: isToday ? '#fff' : isEmpty ? 'transparent' : w.text1,
                cursor: isEmpty ? 'default' : 'pointer',
                transition: 'background 0.12s ease',
              }}
              onMouseEnter={(e) => {
                if (!isToday && !isEmpty) e.currentTarget.style.background = w.bgHover
              }}
              onMouseLeave={(e) => {
                if (!isToday && !isEmpty) e.currentTarget.style.background = 'transparent'
              }}
            >
              {day || ''}
              {dotColor && !isToday && (
                <div style={{
                  position: 'absolute', bottom: '3px', left: '50%', transform: 'translateX(-50%)',
                  width: '3px', height: '3px', borderRadius: '50%',
                  background: dotColor,
                }} />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function Win11Notch({ currentTemplate, onSwitchTemplate }: Props) {
  const [activeModule, setActiveModule] = useState<Module>('none')
  const [mode, setMode] = useState<'idle' | 'peek' | 'expanded'>('idle')
  const { isOpen, setIsOpen } = useHotzone(mode)
  const { track: rawTrack, isPlaying, playPause, next, prev } = useMediaSession()
  const [notifications, setNotifications] = useState<Notif[]>(MOCK_NOTIFS)
  const [now, setNow] = useState(new Date())
  const isMouseOverRef = useRef(false)
  const activeModuleRef = useRef<Module>('none')
  const prevNotificationsRef = useRef<Notif[]>([])
  const isInitialRef = useRef(true)
  const isToastHoveredRef = useRef(false)
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [activeToast, setActiveToast] = useState<Notif | null>(null)

  useEffect(() => { activeModuleRef.current = activeModule }, [activeModule])

  useEffect(() => {
    const iv = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(iv)
  }, [])

  useEffect(() => {
    if (!isOpen) {
      setMode('idle')
    } else {
      setMode('expanded')
      if (activeModuleRef.current === 'none') setActiveModule('music')
    }
  }, [isOpen])

  useEffect(() => {
    if (!isTauri) return
    const unlisten = listen<string>('tray-navigate', (event) => {
      const tab = event.payload
      if (tab === 'music' || tab === 'notifications' || tab === 'calendar') {
        setActiveModule(tab === 'notifications' ? 'notif' : (tab as Module))
        setIsOpen(true)
      }
    })
    return () => { unlisten.then(fn => fn()) }
  }, [])

  useEffect(() => {
    if (!isTauri) {
      const timer = setTimeout(() => {
        setNotifications(prev => [{
          id: 'mock-new-1',
          app: 'WhatsApp',
          message: 'Nandha Kumar: The recruitment module is live! Check it out.',
          time: 'now',
          unread: true,
        }, ...prev])
      }, 4000)
      return () => clearTimeout(timer)
    }
    const fetchN = async () => {
      try {
        const list = await invoke<any[]>('get_windows_notifications')
        setNotifications(list.map(item => ({
          id: item.id || Math.random().toString(),
          app: item.app || 'System',
          message: item.message || '',
          time: item.time || 'now',
          unread: item.unread ?? true,
        })))
      } catch {}
    }
    fetchN()
    const iv = setInterval(fetchN, 5000)
    return () => clearInterval(iv)
  }, [])

  useEffect(() => {
    if (isInitialRef.current) {
      if (notifications.length > 0 || !isTauri) {
        isInitialRef.current = false
        prevNotificationsRef.current = notifications
      }
      return
    }
    const newNotifs = notifications.filter(n => !prevNotificationsRef.current.some(p => p.id === n.id))
    if (newNotifs.length > 0) {
      setActiveToast(newNotifs[0])
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
      toastTimerRef.current = setTimeout(() => {
        if (!isToastHoveredRef.current) setActiveToast(null)
      }, 7000)
    }
    prevNotificationsRef.current = notifications
  }, [notifications])

  useEffect(() => {
    if (isOpen) setActiveToast(null)
  }, [isOpen])

  const handleDismiss = async (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id))
    if (isTauri) {
      const num = parseInt(id, 10)
      if (!isNaN(num)) await invoke('dismiss_notification', { id: num }).catch(() => {})
    }
  }

  const handlePillClick = () => {
    if (!isOpen) { setActiveModule('music'); setIsOpen(true); return }
    const idx = CONTENT_MODULES.indexOf(activeModule as any)
    setActiveModule(CONTENT_MODULES[(idx + 1) % CONTENT_MODULES.length])
  }

  const notifUnread = notifications.filter(n => n.unread).length
  const track = {
    title: rawTrack?.title || 'Nothing Playing',
    artist: rawTrack?.artist || '—',
    albumArt: rawTrack?.albumArt || undefined,
  }
  const timeStr = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })

  const TAB_DEFS = [
    { id: 'music' as Module, label: '♪ Music' },
    { id: 'notif' as Module, label: notifUnread > 0 ? `● Alerts (${notifUnread})` : '● Alerts' },
    { id: 'calendar' as Module, label: '◆ Cal' },
  ]

  return (
    <div style={{
      width: '100vw', height: '100vh',
      background: 'transparent',
      display: 'flex', justifyContent: 'center', alignItems: 'flex-start',
      pointerEvents: 'none',
    }}>
      <div style={{ pointerEvents: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <AnimatePresence mode="popLayout">
          {!isOpen && isPlaying ? (
            /* ── Playing Mica bar ── */
            <motion.div
              key="win11-playing"
              initial={{ y: -24, opacity: 0, scale: 0.9 }}
              animate={{ y: 0, opacity: 1, scale: 1, transition: { type: 'spring' as const, stiffness: 420, damping: 30, mass: 1 } }}
              exit={{ opacity: 0, scale: 0.92, y: -10, transition: { duration: 0.1 } }}
              onClick={handlePillClick}
              style={{
                ...mica,
                borderRadius: w.radius,
                padding: '5px 14px 5px 6px',
                display: 'flex', alignItems: 'center', gap: '10px',
                cursor: 'pointer',
                boxShadow: `0 4px 28px rgba(0,0,0,0.38), inset 0 1px 0 ${w.borderTop}`,
              }}
            >
              {/* Album art */}
              <div style={{
                width: '28px', height: '28px', borderRadius: '6px', flexShrink: 0,
                background: track.albumArt
                  ? `url(${track.albumArt}) center/cover`
                  : `linear-gradient(135deg, ${w.today} 0%, ${w.accent} 100%)`,
                border: `1px solid ${w.borderTop}`,
                boxShadow: `0 0 12px ${w.accentGlow}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {!track.albumArt && (
                  <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: '11px', lineHeight: 1 }}>♪</span>
                )}
              </div>

              <div style={{ width: '1px', height: '18px', background: w.border, flexShrink: 0 }} />

              <span style={{ fontFamily: w.font, fontSize: '13px', fontWeight: 400, color: w.text1, letterSpacing: '0.02em', whiteSpace: 'nowrap' }}>
                {timeStr}
              </span>

              <div style={{ width: '1px', height: '18px', background: w.border, flexShrink: 0 }} />

              {/* Animated wave bars */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '2.5px' }}>
                {[0.0, 0.09, 0.18, 0.06, 0.15, 0.03, 0.12].map((delay, i) => (
                  <div key={i} style={{
                    width: '2.5px', height: '16px', borderRadius: '2px',
                    background: w.accent, transformOrigin: 'center',
                    animation: `waveBar 0.85s ease-in-out ${delay}s infinite`,
                  }} />
                ))}
              </div>

              {notifUnread > 0 && (
                <div style={{
                  minWidth: '17px', height: '17px', borderRadius: '4px', flexShrink: 0,
                  background: w.today, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '9px', fontWeight: 600, color: '#fff', fontFamily: w.font,
                  boxShadow: `0 0 8px ${w.accentGlow}`, padding: '0 3px',
                }}>
                  {notifUnread > 9 ? '9+' : notifUnread}
                </div>
              )}
            </motion.div>
          ) : !isOpen ? (
            /* ── Idle Mica bar ── */
            <motion.div
              key="win11-idle"
              initial={{ y: -20, opacity: 0, scale: 0.95 }}
              animate={{ y: 0, opacity: 1, scale: 1, transition: { type: 'spring' as const, stiffness: 380, damping: 28, mass: 1 } }}
              exit={{ opacity: 0, scale: 0.95, y: -10, transition: { duration: 0.1 } }}
              onClick={handlePillClick}
              style={{
                ...mica,
                borderRadius: w.radius,
                padding: '7px 20px',
                display: 'flex', alignItems: 'center', gap: '10px',
                cursor: 'pointer',
                boxShadow: `0 4px 20px rgba(0,0,0,0.28), inset 0 1px 0 ${w.borderTop}`,
              }}
            >
              <span style={{ fontFamily: w.font, fontSize: '14px', fontWeight: 300, color: w.text1, letterSpacing: '0.02em', whiteSpace: 'nowrap' }}>
                {timeStr}
              </span>

              <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: w.text3, flexShrink: 0 }} />

              <span style={{ fontFamily: w.font, fontSize: '11px', fontWeight: 400, color: w.text2, whiteSpace: 'nowrap' }}>
                {now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
              </span>

              {notifUnread > 0 && (
                <>
                  <div style={{ width: '1px', height: '14px', background: w.border, flexShrink: 0 }} />
                  <div style={{
                    minWidth: '17px', height: '17px', borderRadius: '4px', flexShrink: 0,
                    background: w.today, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '9px', fontWeight: 600, color: '#fff', fontFamily: w.font,
                    boxShadow: `0 0 8px ${w.accentGlow}`, padding: '0 3px',
                  }}>
                    {notifUnread > 9 ? '9+' : notifUnread}
                  </div>
                </>
              )}
            </motion.div>
          ) : (
            /* ── Expanded Mica panel ── */
            <motion.div
              key="win11-expanded"
              initial={{ opacity: 0, scaleY: 0.48, scaleX: 0.92, y: -6 }}
              animate={{ opacity: 1, scaleY: 1, scaleX: 1, y: 0, transition: { type: 'spring' as const, stiffness: 400, damping: 32, mass: 0.95 } }}
              exit={{ opacity: 0, scaleY: 0.55, scaleX: 0.94, y: -6, transition: { duration: 0.1 } }}
              onMouseEnter={() => { isMouseOverRef.current = true }}
              onMouseLeave={() => { isMouseOverRef.current = false; setIsOpen(false) }}
              style={{
                ...mica,
                borderRadius: w.radius,
                width: '360px',
                display: 'flex', flexDirection: 'column',
                transformOrigin: 'top center',
                overflow: 'hidden',
                boxShadow: `0 12px 48px rgba(0,0,0,0.40), inset 0 1px 0 ${w.borderTop}`,
              }}
            >
              {/* Subtle accent shimmer at top */}
              <div style={{
                position: 'absolute', top: 0, left: 0, right: 0, height: '60px',
                background: 'linear-gradient(180deg, rgba(96,205,255,0.04) 0%, transparent 100%)',
                pointerEvents: 'none',
              }} />

              {/* Fluent tab bar — bottom-border style */}
              <div style={{
                position: 'relative',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '6px 10px 0',
                borderBottom: `1px solid ${w.border}`,
              }}>
                <div style={{ display: 'flex', flex: 1, justifyContent: 'center' }}>
                  {TAB_DEFS.map(tab => {
                    const isActive = activeModule === tab.id
                    return (
                      <button
                        key={tab.id}
                        onClick={() => setActiveModule(tab.id)}
                        style={{
                          padding: '7px 14px',
                          background: 'transparent', border: 'none',
                          borderBottom: isActive ? `2px solid ${w.accent}` : '2px solid transparent',
                          fontFamily: w.font,
                          fontSize: '10px',
                          fontWeight: isActive ? 600 : 400,
                          color: isActive ? w.accent : w.text2,
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                          marginBottom: '-1px',
                          letterSpacing: '0.01em',
                        }}
                      >
                        {tab.label}
                      </button>
                    )
                  })}
                </div>

                {/* Settings gear */}
                <button
                  onClick={() => setActiveModule(activeModule === 'settings' ? 'music' : 'settings')}
                  title="Switch template"
                  style={{
                    width: '28px', height: '28px',
                    borderRadius: '6px',
                    background: activeModule === 'settings' ? w.bgAccent : 'transparent',
                    border: `1px solid ${activeModule === 'settings' ? w.accent + '40' : 'transparent'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: activeModule === 'settings' ? w.accent : w.text3,
                    cursor: 'pointer', flexShrink: 0,
                    transition: 'all 0.15s ease',
                    marginBottom: '4px',
                  }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <circle cx="12" cy="12" r="3" />
                    <path d="M19.07 4.93A10 10 0 1 0 4.93 19.07" />
                    <path d="M20.49 16.75A10 10 0 0 1 7.25 3.51" />
                  </svg>
                </button>
              </div>

              {/* Module content */}
              <AnimatePresence mode="wait">
                {activeModule === 'music' && (
                  <motion.div key="music"
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    transition={{ duration: 0.12 }}
                    style={{ padding: '18px 16px 20px' }}
                  >
                    {/* Album art + track info */}
                    <div style={{ display: 'flex', gap: '16px', marginBottom: '20px' }}>
                      <div style={{
                        width: '60px', height: '60px', flexShrink: 0,
                        borderRadius: '8px',
                        background: track.albumArt
                          ? `url(${track.albumArt}) center/cover`
                          : `linear-gradient(135deg, ${w.today} 0%, ${w.accent}80 100%)`,
                        border: `1px solid ${w.borderTop}`,
                        boxShadow: `0 4px 20px ${w.accentGlow}`,
                      }} />
                      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                        <div style={{
                          fontFamily: w.font, fontSize: '14px', fontWeight: 600, color: w.text1,
                          letterSpacing: '-0.01em',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {track.title}
                        </div>
                        <div style={{ fontFamily: w.font, fontSize: '11px', color: w.text2, marginTop: '3px' }}>
                          {track.artist}
                        </div>
                      </div>
                    </div>

                    {/* Fluent controls — rounded square buttons */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                      {([
                        { label: '⏮', action: prev, primary: false },
                        { label: isPlaying ? '⏸' : '▶', action: playPause, primary: true },
                        { label: '⏭', action: next, primary: false },
                      ] as const).map(({ label, action, primary }) => (
                        <button
                          key={label}
                          onClick={action}
                          style={{
                            width: primary ? '46px' : '34px',
                            height: primary ? '46px' : '34px',
                            borderRadius: primary ? '50%' : '8px',
                            background: primary ? w.today : w.bgCard,
                            border: primary ? 'none' : `1px solid ${w.border}`,
                            boxShadow: primary ? `0 4px 18px ${w.accentGlow}` : 'none',
                            color: '#fff',
                            fontSize: primary ? '17px' : '14px',
                            cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontFamily: w.font,
                            transition: 'transform 0.12s ease, background 0.15s ease',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.transform = 'scale(1.07)'
                            if (!primary) e.currentTarget.style.background = w.bgHover
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'scale(1)'
                            if (!primary) e.currentTarget.style.background = w.bgCard
                          }}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}

                {activeModule === 'notif' && (
                  <motion.div key="notif"
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    transition={{ duration: 0.12 }}
                    style={{ padding: '10px 12px 12px', display: 'flex', flexDirection: 'column', gap: '5px' }}
                  >
                    {notifications.length === 0 ? (
                      <div style={{ textAlign: 'center', color: w.text3, fontFamily: w.font, fontSize: '12px', padding: '24px 0' }}>
                        No notifications
                      </div>
                    ) : notifications.map(n => (
                      <div key={n.id} style={{
                        display: 'flex', alignItems: 'center', gap: '10px',
                        padding: '9px 11px',
                        borderRadius: '8px',
                        background: n.unread ? w.bgAccent : w.bgCard,
                        border: `1px solid ${n.unread ? w.accent + '30' : w.border}`,
                        boxShadow: n.unread ? `inset 0 1px 0 rgba(255,255,255,0.08)` : 'none',
                      }}>
                        <div style={{
                          width: '6px', height: '6px', borderRadius: '50%', flexShrink: 0,
                          background: n.unread ? w.accent : 'transparent',
                          border: `1px solid ${n.unread ? w.accent : w.border}`,
                          boxShadow: n.unread ? `0 0 8px ${w.accentGlow}` : 'none',
                        }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontFamily: w.font, fontSize: '10px', fontWeight: 600, color: w.accent, marginBottom: '2px', letterSpacing: '0.01em' }}>{n.app}</div>
                          <div style={{ fontFamily: w.font, fontSize: '11px', color: w.text1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.message}</div>
                        </div>
                        <span style={{ fontFamily: w.font, fontSize: '10px', color: w.text3, flexShrink: 0 }}>{n.time}</span>
                        <button
                          onClick={() => handleDismiss(n.id)}
                          style={{
                            background: 'none', border: 'none', color: w.text3, cursor: 'pointer',
                            fontSize: '11px', padding: '2px 4px', borderRadius: '4px', flexShrink: 0,
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = w.bgHover }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = 'none' }}
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </motion.div>
                )}

                {activeModule === 'calendar' && (
                  <motion.div key="calendar"
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    transition={{ duration: 0.12 }}
                  >
                    <Win11Calendar />
                  </motion.div>
                )}

                {activeModule === 'settings' && (
                  <motion.div key="settings"
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    transition={{ duration: 0.12 }}
                  >
                    <TemplateSwitcherPanel
                      current={currentTemplate}
                      onSelect={(t) => { onSwitchTemplate(t); setIsOpen(false) }}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Toast — only while collapsed */}
        <AnimatePresence mode="popLayout">
          {!isOpen && activeToast && (
            <motion.div
              key={activeToast.id}
              variants={toastVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              onMouseEnter={() => {
                isToastHoveredRef.current = true
                if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
              }}
              onMouseLeave={() => {
                isToastHoveredRef.current = false
                toastTimerRef.current = setTimeout(() => setActiveToast(null), 4000)
              }}
              style={{
                marginTop: '8px',
                width: '360px',
                background: 'rgba(22, 22, 32, 0.94)',
                backdropFilter: w.blur,
                WebkitBackdropFilter: w.blur,
                borderRadius: w.radius,
                borderTop: `1px solid ${w.borderTop}`,
                borderLeft: `1px solid ${w.border}`,
                borderRight: `1px solid ${w.border}`,
                borderBottom: `1px solid ${w.border}`,
                display: 'flex', alignItems: 'center',
                padding: '10px 14px', gap: '10px',
                boxShadow: `0 8px 32px rgba(0,0,0,0.5), inset 0 1px 0 ${w.borderTop}`,
              }}
            >
              <div style={{
                width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0,
                background: APP_TOAST_COLORS[activeToast.app] || w.accent,
                boxShadow: `0 0 8px ${APP_TOAST_COLORS[activeToast.app] || w.accent}`,
              }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: w.font, fontSize: '10px', fontWeight: 600, color: APP_TOAST_COLORS[activeToast.app] || w.accent, marginBottom: '1px', letterSpacing: '0.01em' }}>
                  {activeToast.app}
                </div>
                <div style={{ fontFamily: w.font, fontSize: '12px', color: w.text1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {activeToast.message}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                <span style={{ fontFamily: w.font, fontSize: '10px', color: w.text3 }}>{activeToast.time}</span>
                <button
                  onClick={() => setActiveToast(null)}
                  style={{ background: 'none', border: 'none', color: w.text3, cursor: 'pointer', fontSize: '12px', padding: '2px 4px', borderRadius: '4px' }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = w.bgHover }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'none' }}
                >
                  ✕
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
