import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useHotzone } from '../hooks/useHotzone'
import { useMediaSession } from '../hooks/useMediaSession'
import { tokens } from '../tokens'
import { invoke } from '@tauri-apps/api/core'
import CollapsedNotch from './CollapsedNotch'
import MusicModule from './MusicModule'
import NotificationsModule, { Notification } from './NotificationsModule'
import CalendarModule from './CalendarModule'

type ActiveModule = 'none' | 'dashboard' | 'notifications'
type Template = 'cyberpunk' | 'apple'

interface Props {
  currentTemplate: Template
  onSwitchTemplate: (t: Template) => void
}

const MOCK_NOTIFICATIONS: Notification[] = [
  { id: '1', app: 'Gmail', message: 'Gowtham: Hey can you push the HRMS build today?', time: '2m', unread: true },
  { id: '2', app: 'WhatsApp', message: 'Nandha Kumar: Great work on the recruitment module da', time: '15m', unread: true },
  { id: '3', app: 'System', message: 'AWS S3 nuke-hrms-media-dev storage at 78%', time: '1h', unread: false },
]

const MOCK_EVENTS = [
  { id: '1', title: 'SRM Lab Submission', timeRange: '10:00 – 11:00 AM', stripe: '#A78BFA', badgeLabel: 'URGENT', badgeColor: '#F87171' },
  { id: '2', title: 'Nuke Sprint Review', timeRange: '2:30 – 3:30 PM', stripe: '#60A5FA', badgeLabel: 'MEET', badgeColor: '#60A5FA' },
  { id: '3', title: 'Push HRMS to staging', timeRange: '5:00 PM', stripe: '#4ADE80', badgeLabel: 'TASK', badgeColor: '#4ADE80' },
]

const toastVariants = {
  initial: {
    y: -40,
    opacity: 0,
    scale: 0.92,
  },
  animate: {
    y: 0,
    opacity: 1,
    scale: 1,
    transition: {
      type: 'spring' as const,
      stiffness: 420,
      damping: 28,
      mass: 0.9,
    }
  },
  exit: {
    y: -24,
    opacity: 0,
    scale: 0.92,
    transition: {
      type: 'tween' as const,
      ease: 'easeIn' as const,
      duration: 0.12,
    }
  }
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

const collapsedVariants = {
  initial: {
    y: -24,
    opacity: 0,
    scale: 0.92,
  },
  animate: {
    y: 0,
    opacity: 1,
    scale: 1,
    transition: {
      type: 'spring' as const,
      stiffness: 520,
      damping: 34,
      mass: 0.85,
    }
  },
  exit: {
    opacity: 0,
    scale: 0.9,
    transition: {
      duration: 0.06,
    }
  }
}

const expandedVariants = {
  initial: {
    opacity: 0,
    scaleY: 0.45,
    scaleX: 0.92,
    y: -4,
  },
  animate: {
    opacity: 1,
    scaleY: 1,
    scaleX: 1,
    y: 0,
    transition: {
      type: 'spring' as const,
      stiffness: 600,
      damping: 37,
      mass: 0.8,
    }
  },
  exit: {
    opacity: 0,
    scaleY: 0.6,
    scaleX: 0.95,
    y: -4,
    transition: {
      duration: 0.08,
    }
  }
}

const isTauri = typeof window !== 'undefined' && !!(window as any).__TAURI_INTERNALS__;

export default function NotchWidget({ currentTemplate, onSwitchTemplate }: Props) {
  const [activeModule, setActiveModule] = useState<ActiveModule>('none')
  const [showSettings, setShowSettings] = useState(false)
  const [mode, setMode] = useState<'idle' | 'peek' | 'expanded'>('idle')
  const { isOpen, setIsOpen } = useHotzone(mode)
  const { track: rawTrack, isPlaying, progress, duration, playPause, next, prev, seek } = useMediaSession()
  const [notifications, setNotifications] = useState<Notification[]>(MOCK_NOTIFICATIONS)

  // Map rawTrack + playback state to match expected interface in MusicModule
  const track = {
    title: rawTrack?.title || 'Nothing playing',
    artist: rawTrack?.artist || '—',
    albumArt: rawTrack?.albumArt || undefined,
    progress,
    duration,
    isPlaying,
  }

  // Synchronize useHotzone hit testing region based on expanded/collapsed state
  useEffect(() => {
    if (!isOpen) {
      setMode('idle')
      setActiveModule('none')
    } else {
      setMode('expanded')
    }
  }, [isOpen])

  const isMouseOverRef = useRef(false)
  const isToastHoveredRef = useRef(false)
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const prevNotificationsRef = useRef<Notification[]>([])
  const isInitialRef = useRef(true)
  const [activeToast, setActiveToast] = useState<Notification | null>(null)

  // Retrieve Windows Notifications with fallback to MOCK
  useEffect(() => {
    if (!isTauri) {
      // Simulate a notification arriving after 4 seconds in browser mode to demonstrate the popup feature
      const timer = setTimeout(() => {
        setNotifications((prev) => [
          {
            id: 'mock-new-1',
            app: 'Gmail',
            message: 'Gowtham: Hey, I just pushed the final build verification! Check it out.',
            time: 'now',
            unread: true,
          },
          ...prev,
        ])
      }, 4000)
      return () => clearTimeout(timer)
    }

    const fetchNotifications = async () => {
      try {
        const list = await invoke<any[]>('get_windows_notifications')
        const mapped: Notification[] = list.map((item) => ({
          id: item.id || Math.random().toString(),
          app: item.app || 'System',
          message: item.message || '',
          time: item.time || 'now',
          unread: item.unread ?? true,
        }))
        setNotifications(mapped)
      } catch (err) {
        console.warn('Failed to fetch Windows notifications:', err)
      }
    }

    fetchNotifications()
    const interval = setInterval(fetchNotifications, 5000)
    return () => clearInterval(interval)
  }, [])

  // Auto-popup logic when a new notification is received (freestanding toast)
  useEffect(() => {
    if (isInitialRef.current) {
      if (notifications.length > 0 || !isTauri) {
        isInitialRef.current = false
        prevNotificationsRef.current = notifications
      }
      return
    }

    const newNotifs = notifications.filter(
      (newNotif) => !prevNotificationsRef.current.some((prevNotif) => prevNotif.id === newNotif.id)
    )

    if (newNotifs.length > 0) {
      const latest = newNotifs[0]
      setActiveToast(latest)

      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current)
      }

      toastTimerRef.current = setTimeout(() => {
        if (!isToastHoveredRef.current) {
          setActiveToast(null)
        }
      }, 7000)
    }

    prevNotificationsRef.current = notifications
  }, [notifications])

  // Automatically hide the active toast if the main panel is expanded
  useEffect(() => {
    if (isOpen) {
      setActiveToast(null)
    }
  }, [isOpen])

  const handleDismissNotification = async (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id))
    if (activeToast?.id === id) {
      setActiveToast(null)
    }
    if (isTauri) {
      try {
        const numericId = parseInt(id, 10)
        if (!isNaN(numericId)) {
          await invoke('dismiss_notification', { id: numericId })
        }
      } catch (err) {
        console.error('Failed to dismiss notification:', err)
      }
    }
  }

  const handleClearAllNotifications = async () => {
    setNotifications([])
    if (isTauri) {
      try {
        await invoke('clear_all_notifications')
      } catch (err) {
        console.error('Failed to clear all notifications:', err)
      }
    }
  }

  // Auto show dashboard when opened
  const currentModule: ActiveModule = !isOpen
    ? 'none'
    : activeModule === 'none'
    ? 'dashboard'
    : activeModule

  const t = tokens

  // Format today's date dynamically
  const dateLabel = new Date()
    .toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' })
    .toUpperCase()

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

        {/* Main widget: collapsed pill ↔ expanded panel */}
        <AnimatePresence mode="popLayout">
          {!isOpen ? (
            <motion.div
              key="collapsed"
              variants={collapsedVariants}
              initial="initial"
              animate="animate"
              exit="exit"
            >
              <CollapsedNotch
                isPlaying={isPlaying}
                notifCount={notifications.filter(n => n.unread).length}
                eventCount={MOCK_EVENTS.length}
                trackTitle={rawTrack?.title}
                trackArtist={rawTrack?.artist}
                onPlayPauseToggle={(e) => {
                  e.stopPropagation()
                  playPause()
                }}
                onOpenDashboard={(e) => {
                  e.stopPropagation()
                  setActiveModule('dashboard')
                  setIsOpen(true)
                }}
                onOpenAlerts={(e) => {
                  e.stopPropagation()
                  setActiveModule('notifications')
                  setIsOpen(true)
                }}
              />
            </motion.div>
          ) : (
            <motion.div
              key="expanded"
              variants={expandedVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              layout
              onMouseEnter={() => { isMouseOverRef.current = true }}
              onMouseLeave={() => {
                isMouseOverRef.current = false
                setIsOpen(false)
              }}
              transition={{
                layout: { type: 'spring' as const, stiffness: 500, damping: 35, mass: 0.85 },
              }}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'stretch',
                background: t.colors.bgSurface,
                border: `1px solid ${t.colors.borderDefault}`,
                clipPath: t.clipPath.default,
                overflow: 'hidden',
                transformOrigin: 'top center',
                width: currentModule === 'dashboard' ? '520px' : '460px',
              }}
            >
              {/* Tab switcher */}
              <div style={{
                display: 'flex',
                width: '100%',
                background: 'rgba(0, 0, 0, 0.2)',
                borderBottom: `1px solid ${t.colors.divider}`,
                alignItems: 'center',
                justifyContent: 'space-between',
              }}>
                <div style={{ display: 'flex' }}>
                  {(['dashboard', 'notifications'] as const).map((mod) => {
                    const labels = { dashboard: '⚡ DASHBOARD', notifications: '◈ ALERTS' }
                    const accents = { dashboard: '#00f0ff', notifications: t.colors.accentOrange }
                    const isActive = currentModule === mod
                    return (
                      <button
                        key={mod}
                        onClick={() => setActiveModule(mod)}
                        style={{
                          padding: '8px 16px',
                          fontFamily: t.fonts.sans,
                          fontSize: '9px', fontWeight: 600,
                          letterSpacing: '0.1em',
                          color: isActive ? t.colors.textPrimary : t.colors.textMuted,
                          background: isActive ? 'rgba(255,255,255,0.02)' : 'transparent',
                          borderBottom: isActive ? `2px solid ${accents[mod]}` : '2px solid transparent',
                          transition: 'all 0.15s ease',
                        }}
                      >{labels[mod]}</button>
                    )
                  })}
                </div>

                {/* Dashboard active sync status + Settings gear */}
                <div style={{
                  paddingRight: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}>
                  <span style={{
                    fontFamily: t.fonts.mono,
                    fontSize: '8px',
                    color: '#4A4A62',
                    letterSpacing: '0.08em',
                  }}>SYS_HUD // ACTIVE</span>
                  <div style={{
                    width: '4px',
                    height: '4px',
                    background: t.colors.accentGreen,
                    boxShadow: t.glow.green,
                  }} />
                  {/* Template switcher gear */}
                  <button
                    onClick={() => setShowSettings(s => !s)}
                    title="Switch template"
                    style={{
                      width: '22px',
                      height: '22px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: showSettings ? t.colors.accentPurple : '#4A4A62',
                      background: showSettings ? 'rgba(167,139,250,0.1)' : 'transparent',
                      border: showSettings ? '1px solid rgba(167,139,250,0.3)' : '1px solid transparent',
                      transition: 'all 0.15s ease',
                      outline: 'none',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.color = t.colors.accentPurple}
                    onMouseLeave={(e) => e.currentTarget.style.color = showSettings ? t.colors.accentPurple : '#4A4A62'}
                  >
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
                      stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                      <circle cx="12" cy="12" r="3" />
                      <path d="M19.07 4.93A10 10 0 1 0 4.93 19.07" />
                      <path d="M20.49 16.75A10 10 0 0 1 7.25 3.51" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Inline settings / template switcher panel */}
              {showSettings && (
                <div style={{
                  padding: '10px 14px 12px',
                  borderBottom: `1px solid ${t.colors.divider}`,
                }}>
                  <div style={{
                    fontFamily: t.fonts.mono,
                    fontSize: '7.5px',
                    color: '#4A4A62',
                    letterSpacing: '0.08em',
                    marginBottom: '8px',
                    textTransform: 'uppercase',
                  }}>
                    // SWITCH_TEMPLATE
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {(['cyberpunk', 'apple'] as Template[]).map(tmpl => {
                      const isActive = currentTemplate === tmpl
                      const accent = tmpl === 'cyberpunk' ? '#00f0ff' : t.colors.accentPurple
                      return (
                        <button
                          key={tmpl}
                          onClick={() => {
                            onSwitchTemplate(tmpl)
                            setShowSettings(false)
                            setIsOpen(false)
                          }}
                          style={{
                            flex: 1,
                            padding: '7px 10px',
                            fontFamily: t.fonts.sans,
                            fontSize: '9px',
                            fontWeight: 600,
                            letterSpacing: '0.08em',
                            textTransform: 'uppercase',
                            color: isActive ? accent : '#4A4A62',
                            background: isActive ? 'rgba(255,255,255,0.03)' : 'transparent',
                            border: isActive ? `1px solid ${accent}40` : '1px solid rgba(255,255,255,0.04)',
                            clipPath: t.clipPath.button,
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.color = accent
                            e.currentTarget.style.borderColor = `${accent}60`
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.color = isActive ? accent : '#4A4A62'
                            e.currentTarget.style.borderColor = isActive ? `${accent}40` : 'rgba(255,255,255,0.04)'
                          }}
                        >
                          {tmpl === 'cyberpunk' ? '⚡ CYBERPUNK' : '◉ APPLE'}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Module content */}
              <AnimatePresence mode="popLayout">
                {currentModule === 'dashboard' && (
                  <motion.div key="dashboard"
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.18 }}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'stretch',
                      height: '210px',
                    }}
                  >
                    {/* Left Column: Music */}
                    <div style={{ width: '265px', flexShrink: 0 }}>
                      <MusicModule
                        track={track}
                        onPlayPause={playPause}
                        onNext={next}
                        onPrev={prev}
                        onSeek={seek}
                      />
                    </div>

                    {/* Middle: Dotted Divider Line */}
                    <div style={{
                      width: '1px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      position: 'relative',
                      background: 'linear-gradient(180deg, rgba(0,240,255,0) 0%, rgba(0,240,255,0.2) 20%, rgba(0,240,255,0.2) 80%, rgba(0,240,255,0) 100%)',
                    }}>
                      <div style={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%) rotate(-90deg)',
                        background: t.colors.bgSurface,
                        border: `1px solid rgba(0, 240, 255, 0.25)`,
                        padding: '1px 4px',
                        fontFamily: t.fonts.mono,
                        fontSize: '6.5px',
                        color: '#00f0ff',
                        whiteSpace: 'nowrap',
                        letterSpacing: '0.05em',
                      }}>
                        SYS_LINK
                      </div>
                    </div>

                    {/* Right Column: Calendar */}
                    <div style={{ flex: 1 }}>
                      <CalendarModule />
                    </div>
                  </motion.div>
                )}
                {currentModule === 'notifications' && (
                  <motion.div key="notifs"
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.18 }}
                    style={{ width: '100%', height: '210px' }}
                  >
                    <NotificationsModule
                      notifications={notifications}
                      onDismiss={handleDismissNotification}
                      onClearAll={handleClearAllNotifications}
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
                marginTop: '6px',
                width: '380px',
                height: '52px',
                background: t.colors.bgSurface,
                border: `1px solid ${t.colors.borderDefault}`,
                clipPath: t.clipPath.default,
                display: 'flex',
                alignItems: 'stretch',
                position: 'relative',
                zIndex: 100,
                boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5)',
              }}
            >
              {/* Stripe */}
              <div style={{
                width: '2px',
                flexShrink: 0,
                background: getSourceColor(activeToast.app),
                boxShadow: `0 0 6px ${getSourceColor(activeToast.app)}60`,
              }} />

              {/* App Icon */}
              <div style={{
                width: '36px',
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <div style={{
                  width: '32px',
                  height: '32px',
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.05)',
                  clipPath: t.clipPath.small,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  {getSourceIcon(activeToast.app, getSourceColor(activeToast.app))}
                </div>
              </div>

              {/* Content */}
              <div style={{
                flex: 1,
                minWidth: 0,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                padding: '0 10px',
                gap: '2px',
              }}>
                <span style={{
                  fontFamily: t.fonts.sans,
                  fontSize: '9px',
                  fontWeight: 600,
                  color: '#4A4A62',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                }}>{activeToast.app}</span>
                <span style={{
                  fontFamily: t.fonts.sans,
                  fontSize: '11px',
                  color: '#9999B0',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}>{activeToast.message}</span>
              </div>

              {/* Close Button */}
              <button
                onClick={() => setActiveToast(null)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: t.colors.textMuted,
                  cursor: 'pointer',
                  padding: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  outline: 'none',
                  transition: 'color 0.15s',
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
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
