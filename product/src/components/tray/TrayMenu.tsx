import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
  type RefObject,
} from 'react'
import { motion } from 'framer-motion'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { getVersion } from '@tauri-apps/api/app'
import { getCurrentWindow, LogicalSize } from '@tauri-apps/api/window'
import Toggle from '../Toggle'
import { useAccentColor } from '../../hooks/useAccentColor'
import type { UpdateProgress } from '../../hooks/useAutoUpdate'
import { useSettings } from '../../hooks/useSettings'
import { useSurfaceOpacity } from '../../hooks/useSurfaceOpacity'
import { useTheme } from '../../hooks/useTheme'
import { color, radius, sectionLabel, spring } from '../../tokens'
import { resolvePanels, type NotchModule } from '../../types/notch'

/*
 * The card's height is whatever its rows add up to, and the window is told to be
 * that plus a gutter (see `useFitWindow` below).
 *
 * It used to be a number in `tauri.conf.json` kept in step with an arithmetic
 * comment here. Adding one row to one group meant editing both, and getting it
 * wrong does not fail anywhere — it clips the card against a window too short for
 * it and, because `tray.rs` positions from the window size, slides the whole
 * popup down over the taskbar. The config height is now only the size the window
 * is born at, before the webview has measured anything.
 */
const CARD_W = 248
const ROW_H = 34
/** Separator block: 4px margin, 1px rule, 4px margin. */
const SEP_H = 9

/**
 * Transparent gutter left for the drop shadow; window is CARD + 2×MARGIN.
 *
 * `tray.rs` knows this number too (`CARD_MARGIN`), because it anchors the card
 * against the taskbar and has to subtract the gutter to find it. Change one and
 * the popup drifts off the taskbar by 12px; change both.
 */
const MARGIN = 12

const isTauri = () => !!(window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__

/**
 * Size the OS window to the card the webview actually laid out.
 *
 * The popup is the one window here whose height is a function of its content —
 * rows come and go with releases — and it is also the one whose position is
 * computed from its size, by `tray.rs`, at the moment it is shown. Measuring is
 * what keeps those two facts from disagreeing.
 *
 * Runs per open as well as on mount: the window is shown and hidden, never
 * rebuilt, and the update row can appear between one open and the next.
 */
function useFitWindow(card: RefObject<HTMLDivElement | null>, openCount: number) {
  useEffect(() => {
    const el = card.current
    if (!el || !isTauri()) return

    // `offsetWidth`/`offsetHeight`, not `getBoundingClientRect()`. The card
    // enters at `scale: 0.96` and this runs on the frame it mounts, so the
    // bounding rect would report 96% of the card and shrink the window a little
    // more on every open. The offset box is the layout size and ignores the
    // transform.
    const width = el.offsetWidth
    const height = el.offsetHeight
    if (height < 1) return

    void getCurrentWindow()
      .setSize(new LogicalSize(width + MARGIN * 2, height + MARGIN * 2))
      .catch(() => {})
    // Row heights are fixed in CSS rather than derived from text, so one
    // measurement per open is stable — no observer needed to catch a late reflow.
  }, [card, openCount])
}

type Action =
  | { kind: 'show' }
  | { kind: 'module'; module: NotchModule }
  | { kind: 'autostart' }
  | { kind: 'settings' }
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

/**
 * The module rows, keyed rather than listed.
 *
 * A `Record` on the union, so adding a card fails to compile until the tray has
 * a row for it — and, more to the point, so the *order* can come from the
 * `panels` preference instead of from the shape of this literal. The popup shows
 * exactly what the notch offers, in the same sequence, because a menu that listed
 * a card the arrows cannot reach would be a second, disagreeing answer to "what
 * does this app have in it".
 *
 * The labels are shorter than `MODULE_LABELS` on purpose: these sit next to an
 * icon in a 248px popup, where "File shelf and notes" is a line that wraps and
 * "File shelf" is a thing you click.
 */
const MODULE_ROWS: Record<NotchModule, { label: string; icon: ReactElement }> = {
  media: {
    label: 'Music player',
    icon: (
      <Icon>
        <path d="M9 18V6l10-2v12" />
        <circle cx="6.5" cy="18" r="2.5" />
        <circle cx="16.5" cy="16" r="2.5" />
      </Icon>
    ),
  },
  launcher: {
    label: 'Quick launcher',
    icon: (
      <Icon>
        <rect x="3" y="3" width="7" height="7" rx="2" />
        <rect x="14" y="3" width="7" height="7" rx="2" />
        <rect x="3" y="14" width="7" height="7" rx="2" />
        <rect x="14" y="14" width="7" height="7" rx="2" />
      </Icon>
    ),
  },
  files: {
    label: 'File shelf',
    icon: (
      <Icon>
        <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      </Icon>
    ),
  },
  notifications: {
    label: 'Notifications',
    icon: (
      <Icon>
        <path d="M18 8a6 6 0 1 0-12 0c0 5-2 6-2 6h16s-2-1-2-6" />
        <path d="M13.7 19a2 2 0 0 1-3.4 0" />
      </Icon>
    ),
  },
  system: {
    label: 'System monitor',
    icon: (
      <Icon>
        <path d="M3 13h3.5l2-5 3 10 2.5-7 1.5 2H21" />
      </Icon>
    ),
  },
  weather: {
    label: 'Weather',
    icon: (
      <Icon>
        <circle cx="8.5" cy="8.5" r="3" />
        <path d="M8.5 2.6v1.4M3.1 8.5h1.4M4.6 4.6l1 1M12.4 4.6l-1 1" />
        <path d="M8.4 19.6a3.6 3.6 0 0 1-.4-7.2 5 5 0 0 1 9.7.4 3.4 3.4 0 0 1-.3 6.8z" />
      </Icon>
    ),
  },
  calendar: {
    label: 'Calendar',
    icon: (
      <Icon>
        <rect x="3.5" y="5" width="17" height="16" rx="2.5" />
        <path d="M3.5 10h17M8 3.5v3M16 3.5v3" />
      </Icon>
    ),
  },
  quickAccess: {
    label: 'Quick Access',
    icon: (
      <Icon>
        <path d="M4 7h16M4 12h16M4 17h16" />
        <circle cx="9" cy="7" r="2" fill="currentColor" stroke="none" />
        <circle cx="15" cy="12" r="2" fill="currentColor" stroke="none" />
        <circle cx="11" cy="17" r="2" fill="currentColor" stroke="none" />
      </Icon>
    ),
  },
}

/** The fixed groups. The module group is built from the preference — see below. */
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
      id: 'settings',
      label: 'Settings',
      action: { kind: 'settings' },
      icon: (
        <Icon>
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 9 19.4a1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1A1.6 1.6 0 0 0 4.6 9a1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z" />
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

  // The popup is a Mica card like every other surface, so it follows the same
  // theme, accent and opacity preferences. Nothing else here reads settings —
  // this is the whole reason the hook is mounted.
  const { settings } = useSettings()
  useSurfaceOpacity(settings.backgroundOpacity)
  useTheme(settings.theme)
  useAccentColor(settings.accentColor)

  // The popup lists what the notch offers, in the notch's order. Spliced in as
  // the second group so the window keeps measuring itself — `useFitWindow` reads
  // the card after layout, so a group that grew or shrank needs no arithmetic
  // anywhere. That is exactly what the measuring was for.
  const groups = useMemo(() => {
    const modules = resolvePanels(settings.panels).visible.map<Row>((id) => ({
      id,
      label: MODULE_ROWS[id].label,
      icon: MODULE_ROWS[id].icon,
      action: { kind: 'module', module: id },
    }))
    return [GROUPS[0], modules, ...GROUPS.slice(1)]
  }, [settings.panels])

  // `tray.rs` positions this window from its size, so the size has to be the
  // truth about the card rather than a number in the config hoping to be.
  const cardRef = useRef<HTMLDivElement>(null)
  useFitWindow(cardRef, openCount)

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
    // The payload gained byte counts when the notch grew its own loader, and it
    // is broadcast now rather than sent here alone — the automatic update starts
    // by itself and this popup is usually not open for it. Either way the row
    // only wants the percentage.
    const pending = listen<UpdateProgress>('updater-progress', (event) => {
      setUpdate({ kind: 'downloading', percent: event.payload.percent })
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
      case 'settings':
        // Rust dismisses the popup as part of opening the window, so that focus
        // does not bounce between the two.
        void invoke('settings_open')
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
        ref={cardRef}
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
                color: color.onAccent,
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

          {groups.map((group, index) => (
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

                    {row.action.kind === 'autostart' && <Toggle on={autostart} />}
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
