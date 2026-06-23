import { useState, useRef, useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useHotzone } from '../hooks/useHotzone'
import { useMediaSession } from '../hooks/useMediaSession'
import { invoke } from '@tauri-apps/api/core'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { listen } from '@tauri-apps/api/event'
import { apple } from '../tokens'
import IslandPill from './IslandPill'
import MusicIsland from './MusicIsland'
import NotifIsland from './NotifIsland'
import CalendarIsland from './CalendarIsland'

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

const toastVariants = {
  initial: { y: -24, opacity: 0, scale: 0.92 },
  animate: {
    y: 0, opacity: 1, scale: 1,
    transition: { type: 'spring' as const, stiffness: 420, damping: 28, mass: 0.9 },
  },
  exit: {
    y: -16, opacity: 0, scale: 0.92,
    transition: { type: 'tween' as const, ease: 'easeIn' as const, duration: 0.1 },
  },
}

const APP_TOAST_COLORS: Record<string, string> = {
  Gmail: apple.blue,
  WhatsApp: apple.green,
  System: apple.orange,
}

const isTauri = typeof window !== 'undefined' && !!(window as any).__TAURI_INTERNALS__

const CONTENT_MODULES: Module[] = ['music', 'notif', 'calendar']

// Pill: fast exit when expanding
const pillContainerVariants = {
  initial: { y: -24, opacity: 0, scale: 0.9 },
  animate: {
    y: 0, opacity: 1, scale: 1,
    transition: { type: 'spring' as const, stiffness: 550, damping: 36, mass: 0.85 },
  },
  exit: {
    opacity: 0, scale: 0.9,
    transition: { duration: 0.06 },
  },
}

// Island: expands from top (all-spring, no mixed timing)
const expandedContainerVariants = {
  initial: { opacity: 0, scaleY: 0.5, scaleX: 0.92, y: -4 },
  animate: {
    opacity: 1, scaleY: 1, scaleX: 1, y: 0,
    transition: {
      type: 'spring' as const,
      stiffness: 600,
      damping: 38,
      mass: 0.8,
    },
  },
  exit: {
    opacity: 0, scaleY: 0.6, scaleX: 0.95, y: -4,
    transition: { duration: 0.08 },
  },
}

export function TemplateSwitcherPanel({
  current,
  onSelect,
}: {
  current: Template
  onSelect: (t: Template) => void
}) {
  const options: { id: Template; name: string; desc: string; accent: string; dot: string }[] = [
    { id: 'apple', name: 'Dynamic Island', desc: 'Apple iOS pill — spring physics', accent: '#FFFFFF', dot: '#32D74B' },
    { id: 'cyberpunk', name: 'Cyberpunk OS', desc: 'Neon HUD overlay — sci-fi theme', accent: '#00f0ff', dot: '#ff007f' },
    { id: 'glass', name: 'Glassmorphism', desc: 'Frosted glass, blur, translucent layers', accent: '#7DD3FC', dot: '#C4B5FD' },
    { id: 'win11', name: 'Windows 11 Native', desc: 'Mica material, acrylic blur, fluent design', accent: '#60CDFF', dot: '#60CDFF' },
  ]

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      style={{ padding: '12px 14px 16px' }}
    >
      <div style={{
        fontFamily: "'Inter', -apple-system, sans-serif",
        fontSize: '11px',
        fontWeight: 600,
        color: apple.text3,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        marginBottom: '10px',
        paddingLeft: '2px',
      }}>
        Choose Template
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {options.map(opt => {
          const isActive = current === opt.id
          return (
            <button
              key={opt.id}
              className="apple-active-feedback"
              onClick={() => onSelect(opt.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '10px 12px',
                borderRadius: '12px',
                background: isActive ? apple.fill2 : apple.fill4,
                border: `1px solid ${isActive ? apple.fill1 : 'transparent'}`,
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.18s ease',
                width: '100%',
              }}
            >
              {/* Color swatch */}
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: `linear-gradient(135deg, ${opt.accent}22, ${opt.dot}22)`,
                border: `1px solid ${opt.accent}30`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}>
                {opt.id === 'apple' ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                    stroke={apple.text2} strokeWidth="2" strokeLinecap="round">
                    <rect x="5" y="2" width="14" height="20" rx="4" />
                    <line x1="12" y1="6" x2="12" y2="6" strokeWidth="3" />
                  </svg>
                ) : opt.id === 'glass' ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                    stroke={apple.text2} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="12,2 20,7 20,17 12,22 4,17 4,7" />
                    <polygon points="12,7 16,9.5 16,14.5 12,17 8,14.5 8,9.5" />
                  </svg>
                ) : opt.id === 'win11' ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill={apple.text2}>
                    <rect x="3" y="3" width="8" height="8" rx="1" />
                    <rect x="13" y="3" width="8" height="8" rx="1" />
                    <rect x="3" y="13" width="8" height="8" rx="1" />
                    <rect x="13" y="13" width="8" height="8" rx="1" />
                  </svg>
                ) : (
                  <span style={{ fontSize: '14px' }}>⚡</span>
                )}
              </div>

              <div style={{ flex: 1 }}>
                <div style={{
                  fontFamily: "'Inter', sans-serif",
                  fontSize: '12px',
                  fontWeight: 600,
                  color: isActive ? apple.text1 : apple.text2,
                  letterSpacing: '-0.01em',
                }}>
                  {opt.name}
                </div>
                <div style={{
                  fontFamily: "'Inter', sans-serif",
                  fontSize: '10px',
                  color: apple.text3,
                  marginTop: '1px',
                }}>
                  {opt.desc}
                </div>
              </div>

              {/* Active indicator */}
              {isActive && (
                <div style={{
                  width: '7px',
                  height: '7px',
                  borderRadius: '50%',
                  background: opt.dot,
                  flexShrink: 0,
                }} />
              )}
            </button>
          )
        })}
      </div>

      <div style={{
        marginTop: '10px',
        textAlign: 'center',
        fontFamily: "'Inter', sans-serif",
        fontSize: '10px',
        color: apple.text4,
      }}>
        Switches instantly, saved to disk
      </div>

      <div style={{ height: '1px', background: apple.sep, margin: '12px 0 10px' }} />

      <button
        className="apple-active-feedback"
        onClick={() => getCurrentWindow().hide()}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          width: '100%',
          padding: '8px 12px',
          borderRadius: '10px',
          background: apple.fill4,
          border: `1px solid ${apple.sep}`,
          color: apple.text2,
          fontFamily: "'Inter', sans-serif",
          fontSize: '11px',
          fontWeight: 500,
          cursor: 'pointer',
          transition: 'all 0.18s ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = apple.fill3
          e.currentTarget.style.color = apple.text1
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = apple.fill4
          e.currentTarget.style.color = apple.text2
        }}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
          <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
          <line x1="1" y1="1" x2="23" y2="23" />
        </svg>
        Hide to Tray
      </button>
    </motion.div>
  )
}

export default function AppleNotch({ currentTemplate, onSwitchTemplate }: Props) {
  const [activeModule, setActiveModule] = useState<Module>('none')
  const [mode, setMode] = useState<'idle' | 'peek' | 'expanded'>('idle')
  const { isOpen, setIsOpen } = useHotzone(mode)
  const { track: rawTrack, isPlaying, playPause, next, prev } = useMediaSession()
  const [notifications, setNotifications] = useState<Notif[]>(MOCK_NOTIFS)
  const isMouseOverRef = useRef(false)
  const activeModuleRef = useRef<Module>('none')
  const prevNotificationsRef = useRef<Notif[]>([])
  const isInitialRef = useRef(true)
  const isToastHoveredRef = useRef(false)
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [activeToast, setActiveToast] = useState<Notif | null>(null)

  useEffect(() => {
    activeModuleRef.current = activeModule
  }, [activeModule])

  const track = {
    title: rawTrack?.title || 'Nothing Playing',
    artist: rawTrack?.artist || '—',
    albumArt: rawTrack?.albumArt || undefined,
    isPlaying,
  }

  useEffect(() => {
    if (!isOpen) {
      setMode('idle')
    } else {
      setMode('expanded')
      if (activeModuleRef.current === 'none') {
        setActiveModule('music')
      }
    }
  }, [isOpen])

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

  // Detect new notifications and show toast
  useEffect(() => {
    if (isInitialRef.current) {
      if (notifications.length > 0 || !isTauri) {
        isInitialRef.current = false
        prevNotificationsRef.current = notifications
      }
      return
    }

    const newNotifs = notifications.filter(
      n => !prevNotificationsRef.current.some(p => p.id === n.id)
    )

    if (newNotifs.length > 0) {
      const latest = newNotifs[0]
      setActiveToast(latest)

      if (toastTimerRef.current) clearTimeout(toastTimerRef.current)

      toastTimerRef.current = setTimeout(() => {
        if (!isToastHoveredRef.current) {
          setActiveToast(null)
        }
      }, 7000)
    }

    prevNotificationsRef.current = notifications
  }, [notifications])

  // Hide toast when panel is expanded
  useEffect(() => {
    if (isOpen) {
      setActiveToast(null)
    }
  }, [isOpen])

  // Listen for tray menu navigation events
  useEffect(() => {
    if (!isTauri) return
    const unlisten = listen<string>('tray-navigate', (event) => {
      const tab = event.payload
      if (tab === 'music' || tab === 'notifications' || tab === 'calendar') {
        setActiveModule(tab as Module)
        setIsOpen(true)
      }
    })
    return () => { unlisten.then(fn => fn()) }
  }, [])

  const handleDismiss = async (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id))
    if (activeToast?.id === id) setActiveToast(null)
    if (isTauri) {
      const num = parseInt(id, 10)
      if (!isNaN(num)) await invoke('dismiss_notification', { id: num }).catch(() => {})
    }
  }

  const handlePillClick = () => {
    if (!isOpen) {
      setActiveModule('music')
      setIsOpen(true)
      return
    }
    const idx = CONTENT_MODULES.indexOf(activeModule as any)
    const nextMod = CONTENT_MODULES[(idx + 1) % CONTENT_MODULES.length]
    setActiveModule(nextMod)
  }

  const notifUnread = notifications.filter(n => n.unread).length

  const TAB_DEFS = [
    { id: 'music' as Module, label: '♪ Music' },
    { id: 'notif' as Module, label: notifUnread > 0 ? `● Alerts (${notifUnread})` : '● Alerts' },
    { id: 'calendar' as Module, label: '◆ Cal' },
  ]

  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      background: 'transparent',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'flex-start',
      pointerEvents: 'none',
    }}>
      <div style={{ pointerEvents: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>

        {/* Pill ↔ Expanded island */}
        <AnimatePresence mode="popLayout">
          {!isOpen ? (
            <motion.div
              key="apple-pill"
              variants={pillContainerVariants}
              initial="initial"
              animate="animate"
              exit="exit"
            >
              <IslandPill
                isPlaying={isPlaying}
                trackTitle={rawTrack?.title}
                albumArt={rawTrack?.albumArt || undefined}
                notifCount={notifUnread}
                activeModule={activeModule}
                onClick={handlePillClick}
              />
            </motion.div>
          ) : (
            <motion.div
              key="apple-expanded"
              variants={expandedContainerVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              onMouseEnter={() => { isMouseOverRef.current = true }}
              onMouseLeave={() => {
                isMouseOverRef.current = false
                setIsOpen(false)
              }}
              style={{
                background: apple.black,
                borderRadius: apple.pillRadius,
                overflow: 'hidden',
                transformOrigin: 'top center',
                width: '360px',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              {/* Tab bar */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingTop: '10px',
                paddingBottom: '2px',
                paddingLeft: '6px',
                paddingRight: '6px',
              }}>
                {/* Content tabs */}
                <div style={{ display: 'flex', gap: '2px', flex: 1, justifyContent: 'center' }}>
                  {TAB_DEFS.map(tab => {
                    const isActive = activeModule === tab.id
                    return (
                      <button
                        key={tab.id}
                        className="apple-active-feedback"
                        onClick={() => setActiveModule(tab.id)}
                        style={{
                          padding: '4px 10px',
                          borderRadius: '20px',
                          background: isActive ? apple.fill1 : 'transparent',
                          fontFamily: "'Inter', -apple-system, sans-serif",
                          fontSize: '10px',
                          fontWeight: 500,
                          color: isActive ? apple.text1 : apple.text3,
                          transition: 'all 0.2s ease',
                        }}
                      >
                        {tab.label}
                      </button>
                    )
                  })}
                </div>

                {/* Settings gear — always on the right */}
                <button
                  className="apple-active-feedback"
                  onClick={() => setActiveModule(activeModule === 'settings' ? 'music' : 'settings')}
                  title="Switch template"
                  style={{
                    width: '26px',
                    height: '26px',
                    borderRadius: '50%',
                    background: activeModule === 'settings' ? apple.fill2 : 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: activeModule === 'settings' ? apple.text1 : apple.text3,
                    flexShrink: 0,
                    transition: 'all 0.2s ease',
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

              {/* Thin separator */}
              <div style={{ height: '1px', background: apple.sep, margin: '4px 16px 0' }} />

              {/* Module content */}
              <AnimatePresence mode="wait">
                {activeModule === 'music' && (
                  <motion.div key="music" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
                    <MusicIsland track={track} onPlayPause={playPause} onNext={next} onPrev={prev} />
                  </motion.div>
                )}
                {activeModule === 'notif' && (
                  <motion.div key="notif" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
                    <NotifIsland notifications={notifications} onDismiss={handleDismiss} />
                  </motion.div>
                )}
                {activeModule === 'calendar' && (
                  <motion.div key="calendar" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
                    <CalendarIsland />
                  </motion.div>
                )}
                {activeModule === 'settings' && (
                  <motion.div key="settings" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
                    <TemplateSwitcherPanel
                      current={currentTemplate}
                      onSelect={(t) => {
                        onSwitchTemplate(t)
                        setIsOpen(false)
                      }}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Toast notification — only when collapsed */}
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
                toastTimerRef.current = setTimeout(() => {
                  setActiveToast(null)
                }, 4000)
              }}
              style={{
                marginTop: '8px',
                width: '360px',
                background: 'rgba(28,28,30,0.95)',
                borderRadius: apple.pillRadius,
                border: `1px solid ${apple.sep}`,
                display: 'flex',
                alignItems: 'center',
                padding: '10px 14px',
                gap: '10px',
                position: 'relative',
                zIndex: 100,
                boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
                backdropFilter: 'blur(20px)',
              }}
            >
              {/* Colored dot */}
              <div style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: APP_TOAST_COLORS[activeToast.app] || apple.purple,
                flexShrink: 0,
              }} />

              {/* Content */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontFamily: "'Inter', sans-serif",
                  fontSize: '10px',
                  fontWeight: 600,
                  color: APP_TOAST_COLORS[activeToast.app] || apple.purple,
                  letterSpacing: '-0.01em',
                  marginBottom: '1px',
                }}>
                  {activeToast.app}
                </div>
                <div style={{
                  fontFamily: "'Inter', sans-serif",
                  fontSize: '12px',
                  color: apple.text1,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}>
                  {activeToast.message}
                </div>
              </div>

              {/* Time + Close */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                <span style={{
                  fontFamily: "'Inter', sans-serif",
                  fontSize: '10px',
                  color: apple.text3,
                }}>
                  {activeToast.time}
                </span>
                <button
                  onClick={() => setActiveToast(null)}
                  className="apple-active-feedback"
                  style={{
                    color: apple.text3,
                    width: '20px',
                    height: '20px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    borderRadius: '50%',
                    transition: 'color 0.15s',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.color = apple.text1}
                  onMouseLeave={(e) => e.currentTarget.style.color = apple.text3}
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
