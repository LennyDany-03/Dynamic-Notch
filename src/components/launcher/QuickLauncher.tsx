import { useEffect, useRef, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { getCurrentWindow } from '@tauri-apps/api/window'
import type { AppEntry } from '../../hooks/useAppLauncher'
import { useAppLauncher } from '../../hooks/useAppLauncher'
import { color, radius } from '../../tokens'

const isTauri = () => !!(window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__

const requestWindowFocus = () => {
  if (!isTauri()) return
  getCurrentWindow().setFocus().catch(() => {})
}

/**
 * Resolved icons, kept outside React so remounting the launcher does not re-fetch
 * what is already known.
 *
 * Only successes are stored. The shell's imaging pipeline fails occasionally when
 * it is busy, and remembering that would pin an app to its initial for the rest of
 * the session; leaving it unrecorded means reopening the launcher tries again.
 */
const iconCache = new Map<string, string>()

/** An app's real icon, falling back to its initial until one arrives. */
function AppIcon({ app, px }: { app: AppEntry; px: number }) {
  const [icon, setIcon] = useState<string | null>(() => iconCache.get(app.path) ?? null)

  useEffect(() => {
    if (!isTauri()) return
    const cached = iconCache.get(app.path)
    if (cached !== undefined) {
      setIcon(cached)
      return
    }

    let cancelled = false
    invoke<string | null>('app_icon', { path: app.path })
      .then((data) => {
        if (data) iconCache.set(app.path, data)
        if (!cancelled) setIcon(data ?? null)
      })
      .catch(() => {})

    return () => {
      cancelled = true
    }
  }, [app.path])

  // The initial is the fallback, not the default: it shows for the frame or two
  // before the icon resolves, and permanently for apps that have none.
  if (!icon) {
    return (
      <span style={{ fontSize: 16, fontWeight: 600, color: color.text.strong }}>
        {app.name.charAt(0).toUpperCase()}
      </span>
    )
  }

  return (
    <img
      src={icon}
      alt=""
      width={px}
      height={px}
      draggable={false}
      style={{ display: 'block', objectFit: 'contain' }}
    />
  )
}

/**
 * Quick Launcher — search field and pinned tiles (design state 03, upper half).
 */
export default function QuickLauncher({ launcher }: { launcher: ReturnType<typeof useAppLauncher> }) {
  const { pinned, pinnedPaths, results, query, setQuery, loaded, launch, togglePin, maxPinned } =
    launcher
  const searchRef = useRef<HTMLInputElement>(null)

  const searching = query.trim().length > 0
  const emptySlots = Math.max(0, maxPinned - pinned.length)

  const Tile = ({ app }: { app: AppEntry }) => (
    <button
      type="button"
      className="tile"
      title={app.name}
      onClick={() => launch(app)}
      onContextMenu={(e) => {
        e.preventDefault()
        togglePin(app)
      }}
      style={{
        flex: 1,
        aspectRatio: '1',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 0,
        minWidth: 0,
      }}
    >
      <AppIcon app={app} px={32} />
    </button>
  )

  return (
    <>
      {/* Search — inset well per the design. */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          height: 38,
          padding: '0 12px',
          borderRadius: radius.tile,
          background: color.inset,
          boxShadow: color.insetShadow,
          flex: 'none',
        }}
      >
        <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke={color.text.muted} strokeWidth={1.5} strokeLinecap="round" style={{ flex: 'none' }}>
          <circle cx="11" cy="11" r="6" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <input
          ref={searchRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onPointerDown={requestWindowFocus}
          placeholder={loaded ? 'Search apps…' : 'Indexing…'}
          spellCheck={false}
          style={{
            flex: 1,
            minWidth: 0,
            border: 'none',
            outline: 'none',
            background: 'transparent',
            fontFamily: 'inherit',
            fontSize: 13,
            color: color.text.primary,
            caretColor: color.accent,
            userSelect: 'text',
            WebkitUserSelect: 'text',
          }}
        />
      </div>

      {searching ? (
        <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
          {results.length === 0 ? (
            <span style={{ fontSize: 12, color: color.text.muted, padding: '9px 2px' }}>
              No apps match “{query.trim()}”
            </span>
          ) : (
            results.map((app, i) => (
              <div
                key={app.path}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 11,
                  padding: '9px 2px',
                  borderBottom: i === results.length - 1 ? 'none' : `1px solid ${color.divider}`,
                }}
              >
                <button
                  type="button"
                  onClick={() => launch(app)}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    textAlign: 'left',
                    fontSize: 12,
                    color: color.text.strong,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    padding: 0,
                  }}
                >
                  {app.name}
                </button>
                <button
                  type="button"
                  aria-label={pinnedPaths.includes(app.path) ? 'Unpin' : 'Pin'}
                  title={pinnedPaths.includes(app.path) ? 'Unpin' : 'Pin'}
                  onClick={() => togglePin(app)}
                  style={{ flex: 'none', display: 'flex', padding: 0 }}
                >
                  <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke={pinnedPaths.includes(app.path) ? color.accent : color.text.muted} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 17v5M9 3h6l-1 6 3 3v2H7v-2l3-3z" />
                  </svg>
                </button>
              </div>
            ))
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 10, margin: '14px 0 4px', flex: 'none' }}>
          {pinned.map((app) => (
            <Tile key={app.path} app={app} />
          ))}
          {Array.from({ length: emptySlots }).map((_, i) => (
            <button
              key={`slot-${i}`}
              type="button"
              aria-label="Pin an app"
              title="Search for an app, then pin it"
              onClick={() => searchRef.current?.focus()}
              style={{
                flex: 1,
                aspectRatio: '1',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: radius.tile,
                border: `1px dashed ${color.dashedStrong}`,
                padding: 0,
                minWidth: 0,
              }}
            >
              <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke={color.text.muted} strokeWidth={1.5} strokeLinecap="round">
                <path d="M12 6v12M6 12h12" />
              </svg>
            </button>
          ))}
        </div>
      )}
    </>
  )
}
