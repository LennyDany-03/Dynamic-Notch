import { useState, useRef, useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useHotzone } from '../hooks/useHotzone'
import { useMediaSession } from '../hooks/useMediaSession'
import { invoke } from '@tauri-apps/api/core'
import { apple } from '../tokens'
import IslandPill from './IslandPill'
import MusicIsland from './MusicIsland'
import NotifIsland from './NotifIsland'
import CalendarIsland from './CalendarIsland'

type Module = 'none' | 'music' | 'notif' | 'calendar' | 'settings'
type Template = 'cyberpunk' | 'apple'

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

const isTauri = typeof window !== 'undefined' && !!(window as any).__TAURI_INTERNALS__

const CONTENT_MODULES: Module[] = ['music', 'notif', 'calendar']

// Pill: drop in from top, fade+scale-out (NOT y exit) so it blends into island
const pillContainerVariants = {
  initial: { y: -36, opacity: 0, scale: 0.85 },
  animate: {
    y: 0, opacity: 1, scale: 1,
    transition: { type: 'spring' as const, stiffness: 500, damping: 36, mass: 1 },
  },
  exit: {
    opacity: 0,
    scale: 0.88,
    transition: { duration: 0.10, ease: 'easeIn' as const },
  },
}

// Island: expands from near-top (y:-16), not from far away (y:-60)
const expandedContainerVariants = {
  initial: { y: -16, opacity: 0, scale: 0.94 },
  animate: {
    y: 0, opacity: 1, scale: 1,
    transition: { type: 'spring' as const, stiffness: 420, damping: 34, mass: 0.9 },
  },
  exit: {
    y: -16, opacity: 0, scale: 0.94,
    transition: { duration: 0.10, ease: 'easeIn' as const },
  },
}

function TemplateSwitcherPanel({
  current,
  onSelect,
}: {
  current: Template
  onSelect: (t: Template) => void
}) {
  const options: { id: Template; name: string; desc: string; accent: string; dot: string }[] = [
    { id: 'apple', name: 'Dynamic Island', desc: 'Apple iOS pill — spring physics', accent: '#FFFFFF', dot: '#32D74B' },
    { id: 'cyberpunk', name: 'Cyberpunk OS', desc: 'Neon HUD overlay — sci-fi theme', accent: '#00f0ff', dot: '#ff007f' },
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
    </motion.div>
  )
}

export default function AppleNotch({ currentTemplate, onSwitchTemplate }: Props) {
  const [activeModule, setActiveModule] = useState<Module>('none')
  const [mode, setMode] = useState<'idle' | 'peek' | 'expanded'>('idle')
  const { isOpen, setIsOpen } = useHotzone(mode)
  const { track: rawTrack, isPlaying, progress, duration, playPause, next, prev, seek } = useMediaSession()
  const [notifications, setNotifications] = useState<Notif[]>(MOCK_NOTIFS)
  const isMouseOverRef = useRef(false)
  const activeModuleRef = useRef<Module>('none')

  useEffect(() => {
    activeModuleRef.current = activeModule
  }, [activeModule])

  const track = {
    title: rawTrack?.title || 'Nothing Playing',
    artist: rawTrack?.artist || '—',
    albumArt: rawTrack?.albumArt || undefined,
    progress,
    duration,
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
    if (!isTauri) return
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

  const handleDismiss = async (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id))
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

        {/* Collapsed pill */}
        <AnimatePresence>
          {!isOpen && (
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
          )}
        </AnimatePresence>

        {/* Expanded island card */}
        <AnimatePresence>
          {isOpen && (
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
                    <MusicIsland track={track} onPlayPause={playPause} onNext={next} onPrev={prev} onSeek={seek} />
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
      </div>
    </div>
  )
}
