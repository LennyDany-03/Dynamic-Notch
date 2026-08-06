import { useCallback, useEffect, useState, type ReactElement, type ReactNode } from 'react'
import { motion } from 'framer-motion'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { getVersion } from '@tauri-apps/api/app'
import { color, radius, sectionLabel, spring } from '../../tokens'
import type { NotchModule } from '../../types/notch'

/*
 * Fixed metrics. The window is sized to these in tauri.conf.json — the card must
 * measure exactly CARD_W × CARD_H or the transparent margin around it changes and
 * the popup stops sitting flush against the taskbar.
 *
 *   6 + 40 + 9 + 34 + 9 + (34×3) + 9 + (34×2) + 9 + 34 + 6 = 326
 */
const CARD_W = 248
const ROW_H = 34
/** Separator block: 4px margin, 1px rule, 4px margin. */
const SEP_H = 9

/** Transparent gutter left for the drop shadow; window is CARD + 2×MARGIN. */
const MARGIN = 12

type Action =
  | { kind: 'show' }
  | { kind: 'module'; module: NotchModule }
  | { kind: 'autostart' }
  | { kind: 'update' }
  | { kind: 'quit' }

/** Mirrors `UpdateInfo` in `src-tauri/src/updater.rs`. */
interface UpdateInfo {
  version: string
  notes: string | null
}

/**
 * The update row is a single button that walks a small state machine, because a
 * tray popup has no room for a dialog: idle → checking → up to date, or idle →
 * checking → available → downloading, with a second click spending `available`.
 *
 * `percent: null` covers a server that sent no content-length — there is nothing
 * honest to show but "working on it".
 */
type UpdateState =
  | { kind: 'idle' }
  | { kind: 'checking' }
  | { kind: 'upToDate' }
  | { kind: 'available'; version: string }
  | { kind: 'downloading'; percent: number | null }
  | { kind: 'error' }

interface Row {
  id: string
  label: string
  icon: ReactElement
  action: Action
  danger?: boolean
}

/* 24×24 stroke paths, matching the hand-drawn set used across the modules. */
const stroke = {
  fill: 'none',
  strokeWidth: 1.5,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" width={16} height={16} {...stroke} stroke="currentColor" style={{ flex: 'none' }}>
      {children}
    </svg>
  )
}

const GROUPS: Row[][] = [
  [
    {
      id: 'show',
      label: 'Show notch',
      action: { kind: 'show' },
      icon: (
        <Icon>
          <rect x="3" y="4" width="18" height="9" rx="3" />
          <path d="M9 17h6" />
          <path d="M12 20v-3" />
        </Icon>
      ),
    },
  ],
  [
    {
      id: 'media',
      label: 'Music player',
      action: { kind: 'module', module: 'media' },
      icon: (
        <Icon>
          <path d="M9 18V6l10-2v12" />
          <circle cx="6.5" cy="18" r="2.5" />
          <circle cx="16.5" cy="16" r="2.5" />
        </Icon>
      ),
    },
    {
      id: 'launcher',
      label: 'Quick launcher',
      action: { kind: 'module', module: 'launcher' },
      icon: (
        <Icon>
          <rect x="3" y="3" width="7" height="7" rx="2" />
          <rect x="14" y="3" width="7" height="7" rx="2" />
          <rect x="3" y="14" width="7" height="7" rx="2" />
          <rect x="14" y="14" width="7" height="7" rx="2" />
        </Icon>
      ),
    },
    {
      id: 'files',
      label: 'File shelf',
      action: { kind: 'module', module: 'files' },
      icon: (
        <Icon>
          <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        </Icon>
      ),
    },
  ],
  [
    {
      id: 'autostart',
      label: 'Start with Windows',
      action: { kind: 'autostart' },
      icon: (
        <Icon>
          <path d="M12 3v9" />
          <path d="M7.5 6.5a7 7 0 1 0 9 0" />
        </Icon>
      ),
    },
    {
      id: 'update',
      label: 'Check for updates',
      action: { kind: 'update' },
      icon: (
        <Icon>
          <path d="M12 3v12" />
          <path d="M7 10l5 5 5-5" />
          <path d="M4 20h16" />
        </Icon>
      ),
    },
  ],
  [
    {
      id: 'quit',
      label: 'Quit Crest',
      danger: true,
      action: { kind: 'quit' },
      icon: (
        <Icon>
          <path d="M14 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" />
          <path d="M10 12H3" />
          <path d="M6 9l-3 3 3 3" />
        </Icon>
      ),
    },
  ],
]

/**
 * Row label and right-hand status for the current update state.
 *
 * The label carries the verb so the row always says what a click will do, and the
 * status carries the result — "Check for updates / Up to date" rather than a row
 * that renames itself to a dead end.
 */
function updateRowText(state: UpdateState): { label: string; status: string | null } {
  switch (state.kind) {
    case 'checking':
      return { label: 'Check for updates', status: 'Checking…' }
    case 'upToDate':
      return { label: 'Check for updates', status: 'Up to date' }
    case 'available':
      return { label: `Update to ${state.version}`, status: 'Install' }
    case 'downloading':
      return {
        label: 'Downloading update',
        status: state.percent === null ? 'Starting…' : `${state.percent}%`,
      }
    case 'error':
      return { label: 'Check for updates', status: 'Failed' }
    case 'idle':
      return { label: 'Check for updates', status: null }
  }
}

function Separator() {
  return (
    <div style={{ height: SEP_H, display: 'flex', alignItems: 'center', padding: '0 4px' }}>
      <div style={{ height: 1, width: '100%', background: color.divider }} />
    </div>
  )
}

/**
 * The tray popup — the replacement for the native Win32 menu.
 *
 * Rendered into its own always-on-top window that Rust positions against the
 * taskbar. The window is never destroyed, only hidden, so `openCount` (bumped by
 * the `tray-menu-opened` event) is what remounts the card and replays the entry
 * animation.
 */
export default function TrayMenu() {
  const [openCount, setOpenCount] = useState(0)
  const [hovered, setHovered] = useState<string | null>(null)
  const [autostart, setAutostart] = useState(false)
  const [version, setVersion] = useState('')
  const [update, setUpdate] = useState<UpdateState>({ kind: 'idle' })

  const close = useCallback(() => {
    void invoke('tray_menu_close')
  }, [])

  useEffect(() => {
    getVersion().then(setVersion).catch(() => setVersion(''))
  }, [])

  useEffect(() => {
    const pending = listen('tray-menu-opened', () => {
      setOpenCount((n) => n + 1)
      // Pointer state is stale by the time the popup reopens somewhere else.
      setHovered(null)
      // Autostart can be changed from outside the app, so re-read it per open
      // rather than trusting the last value written here.
      void invoke<boolean>('tray_autostart_enabled').then(setAutostart)
      // A finished result is stale by the next open — a check from an hour ago
      // says nothing about now. Work in flight is left alone.
      setUpdate((prev) =>
        prev.kind === 'upToDate' || prev.kind === 'error' ? { kind: 'idle' } : prev,
      )
    })
    return () => {
      void pending.then((unlisten) => unlisten())
    }
  }, [])

  useEffect(() => {
    const pending = listen<number>('updater-progress', (event) => {
      setUpdate({ kind: 'downloading', percent: event.payload })
    })
    return () => {
      void pending.then((unlisten) => unlisten())
    }
  }, [])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [close])

  const run = (action: Action) => {
    switch (action.kind) {
      case 'show':
        void invoke('tray_show_notch')
        break
      case 'module':
        void invoke('tray_navigate', { module: action.module })
        break
      case 'autostart':
        // Stays open: toggling a setting is not a "pick one and dismiss" action,
        // and closing would hide the state change the user just made.
        void invoke<boolean>('tray_set_autostart', { enabled: !autostart }).then(setAutostart)
        break
      case 'update':
        // Also stays open — the whole point of the row is the status it reports.
        if (update.kind === 'checking' || update.kind === 'downloading') break

        if (update.kind === 'available') {
          setUpdate({ kind: 'downloading', percent: null })
          // Never resolves on success: the installer replaces this process.
          void invoke('updater_install').catch(() => setUpdate({ kind: 'error' }))
          break
        }

        setUpdate({ kind: 'checking' })
        void invoke<UpdateInfo | null>('updater_check')
          .then((info) =>
            setUpdate(info ? { kind: 'available', version: info.version } : { kind: 'upToDate' }),
          )
          .catch(() => setUpdate({ kind: 'error' }))
        break
      case 'quit':
        void invoke('tray_quit')
        break
    }
  }

  return (
    // Clicking the shadow gutter dismisses, matching a click outside the window.
    <div
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close()
      }}
      onContextMenu={(event) => event.preventDefault()}
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: MARGIN,
      }}
    >
      <motion.div
        key={openCount}
        className="mica"
        initial={{ opacity: 0, scale: 0.96, y: 6 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={spring.expand}
        style={{
          width: CARD_W,
          borderRadius: radius.shell,
          padding: '6px 0',
          transformOrigin: 'bottom center',
        }}
      >
        {/* Above .mica::before (noise) and .mica::after (hairline). */}
        <div style={{ position: 'relative', zIndex: 1 }}>
          <header
            style={{
              height: 40,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '0 14px',
            }}
          >
            <div
              style={{
                width: 20,
                height: 20,
                borderRadius: radius.small,
                flex: 'none',
                display: 'grid',
                placeItems: 'center',
                background: color.accent,
                color: '#fff',
                fontSize: 12,
                fontWeight: 700,
                lineHeight: 1,
              }}
            >
              C
            </div>
            <span style={{ fontSize: 13, fontWeight: 600, color: color.text.primary }}>Crest</span>
            <span style={{ ...sectionLabel, marginLeft: 'auto' }}>{version}</span>
          </header>

          {GROUPS.map((group, index) => (
            <div key={index}>
              <Separator />
              {group.map((row) => {
                const isHovered = hovered === row.id
                const tint = row.danger ? color.fileRed : color.text.strong
                const updateText = row.action.kind === 'update' ? updateRowText(update) : null

                return (
                  <button
                    key={row.id}
                    onMouseEnter={() => setHovered(row.id)}
                    onMouseLeave={() => setHovered(null)}
                    onClick={() => run(row.action)}
                    style={{
                      width: `calc(100% - 12px)`,
                      height: ROW_H,
                      margin: '0 6px',
                      padding: '0 8px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      borderRadius: radius.tile,
                      textAlign: 'left',
                      fontSize: 13,
                      fontWeight: 400,
                      color: isHovered ? tint : color.text.body,
                      background: isHovered
                        ? row.danger
                          ? 'rgba(248,113,113,.12)'
                          : color.tile
                        : 'transparent',
                      transition: 'background 90ms linear, color 90ms linear',
                    }}
                  >
                    <span style={{ color: isHovered ? tint : color.text.icon, display: 'flex' }}>
                      {row.icon}
                    </span>
                    <span style={{ flex: 1, minWidth: 0 }}>{updateText?.label ?? row.label}</span>

                    {updateText?.status && (
                      <span
                        style={{
                          flex: 'none',
                          fontSize: 11,
                          fontWeight: 500,
                          // Accent only for the one state that wants a click.
                          color:
                            update.kind === 'available' ? color.accent : color.text.muted,
                        }}
                      >
                        {updateText.status}
                      </span>
                    )}

                    {row.action.kind === 'autostart' && (
                      /* Track + knob, sized so the row height is unchanged. */
                      <span
                        style={{
                          flex: 'none',
                          width: 28,
                          height: 16,
                          borderRadius: radius.pill,
                          padding: 2,
                          display: 'flex',
                          justifyContent: autostart ? 'flex-end' : 'flex-start',
                          background: autostart ? color.accent : color.inset,
                          boxShadow: autostart ? undefined : color.insetShadow,
                          transition: 'background 120ms linear',
                        }}
                      >
                        <motion.span
                          layout
                          transition={spring.peek}
                          style={{
                            width: 12,
                            height: 12,
                            borderRadius: radius.pill,
                            background: autostart ? '#fff' : color.text.muted,
                          }}
                        />
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  )
}
