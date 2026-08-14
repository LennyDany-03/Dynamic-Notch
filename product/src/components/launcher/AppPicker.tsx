import { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { getCurrentWindow } from '@tauri-apps/api/window'
import AppIcon from './AppIcon'
import type { AppEntry } from '../../hooks/useAppLauncher'
import { color, radius, sectionLabel, spring } from '../../tokens'

const isTauri = () => !!(window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__

/**
 * Pick an app to pin, from everything the Start Menu index found.
 *
 * What the empty slot used to do was focus the search field, which asks the user
 * to already know the name of what they want and then find a pin button on the
 * result row. This is the other half of that: browse the list, click one, done.
 * The search field remains the faster path when you do know the name, so this
 * carries its own filter rather than replacing it.
 *
 * A sheet inside the card, like `NotificationDetail`, and for the same hard
 * reason: the overlay's interactive bounds are the card that is drawn, so
 * anything outside it sits on a click-through region and would take no clicks.
 *
 * Rows for apps that are already pinned are not selectable — the sheet's whole
 * verb is "pin this" — but they keep a pin button that unpins, which is the same
 * split the search results use.
 */
export default function AppPicker({
  apps,
  pinnedPaths,
  loaded,
  onPick,
  onUnpin,
  onClose,
}: {
  apps: AppEntry[]
  pinnedPaths: string[]
  loaded: boolean
  onPick: (app: AppEntry) => void
  onUnpin: (app: AppEntry) => void
  onClose: () => void
}) {
  const [filter, setFilter] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  // The overlay window does not hold focus, so a field inside it cannot receive
  // typing until the window is asked for it. Same call the launcher's own search
  // makes on pointer-down; here the sheet opens by a click that already landed on
  // the card, so it can be done once on mount.
  useEffect(() => {
    if (isTauri()) getCurrentWindow().setFocus().catch(() => {})
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // Plain substring rather than the launcher's fuzzy search: this list is being
  // read as well as searched, and a fuzzy match reorders it under the cursor on
  // every keystroke. Sorted by name because the index arrives in directory order,
  // which is no order at all to a person scrolling it.
  const shown = useMemo(() => {
    const needle = filter.trim().toLowerCase()
    return apps
      .filter((app) => !needle || app.name.toLowerCase().includes(needle))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [apps, filter])

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 2 }}>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.12 }}
        onClick={onClose}
        style={{ position: 'absolute', inset: 0, background: color.scrim }}
      />

      <motion.div
        initial={{ opacity: 0, y: 10, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 6, scale: 0.99 }}
        transition={spring.expand}
        style={{
          position: 'absolute',
          inset: '8px 10px',
          borderRadius: radius.tile,
          // Opaque rather than the translucent tile fill: this sits over the
          // pinned row and the clipboard list, and at .055 both read through it.
          background: 'rgba(46,46,46,.97)',
          boxShadow: color.popShadow,
          display: 'flex',
          flexDirection: 'column',
          padding: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 'none' }}>
          <span style={sectionLabel}>Pin an app</span>
          <span style={{ flex: 1 }} />
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            style={{
              width: 22,
              height: 22,
              flex: 'none',
              display: 'grid',
              placeItems: 'center',
              borderRadius: radius.small,
              color: color.text.icon,
            }}
          >
            <svg
              viewBox="0 0 24 24"
              width={13}
              height={13}
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
              strokeLinecap="round"
            >
              <path d="M6 6l12 12" />
              <path d="M18 6L6 18" />
            </svg>
          </button>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            height: 32,
            marginTop: 10,
            padding: '0 10px',
            borderRadius: radius.small,
            background: color.inset,
            boxShadow: color.insetShadow,
            flex: 'none',
          }}
        >
          <svg
            viewBox="0 0 24 24"
            width={14}
            height={14}
            fill="none"
            stroke={color.text.muted}
            strokeWidth={1.5}
            strokeLinecap="round"
            style={{ flex: 'none' }}
          >
            <circle cx="11" cy="11" r="6" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            ref={inputRef}
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            placeholder={loaded ? 'Filter…' : 'Indexing…'}
            spellCheck={false}
            style={{
              flex: 1,
              minWidth: 0,
              border: 'none',
              outline: 'none',
              background: 'transparent',
              fontFamily: 'inherit',
              fontSize: 12,
              color: color.text.primary,
              caretColor: color.accent,
              userSelect: 'text',
              WebkitUserSelect: 'text',
            }}
          />
        </div>

        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', marginTop: 8 }}>
          {shown.length === 0 ? (
            <div
              style={{
                height: '100%',
                display: 'grid',
                placeItems: 'center',
                fontSize: 11.5,
                color: color.text.muted,
              }}
            >
              {loaded ? 'No apps match that' : ''}
            </div>
          ) : (
            shown.map((app) => {
              const isPinned = pinnedPaths.includes(app.path)

              return (
                <div
                  key={app.path}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '0 4px',
                    borderRadius: radius.small,
                  }}
                >
                  <button
                    type="button"
                    // Already pinned: the sheet's verb does not apply, and a row
                    // that silently did nothing would read as a broken click.
                    disabled={isPinned}
                    onClick={() => onPick(app)}
                    title={isPinned ? 'Already pinned' : `Pin ${app.name}`}
                    style={{
                      flex: 1,
                      minWidth: 0,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '7px 2px',
                      textAlign: 'left',
                      opacity: isPinned ? 0.45 : 1,
                      cursor: isPinned ? 'default' : 'pointer',
                    }}
                  >
                    <AppIcon app={app} px={20} />
                    <span
                      style={{
                        flex: 1,
                        minWidth: 0,
                        fontSize: 12,
                        color: color.text.strong,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {app.name}
                    </span>
                  </button>

                  {isPinned && (
                    <button
                      type="button"
                      aria-label={`Unpin ${app.name}`}
                      title="Unpin"
                      onClick={() => onUnpin(app)}
                      style={{ flex: 'none', display: 'flex', padding: '7px 2px' }}
                    >
                      <svg
                        viewBox="0 0 24 24"
                        width={14}
                        height={14}
                        fill="none"
                        stroke={color.accent}
                        strokeWidth={1.6}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M12 17v5M9 3h6l-1 6 3 3v2H7v-2l3-3z" />
                      </svg>
                    </button>
                  )}
                </div>
              )
            })
          )}
        </div>
      </motion.div>
    </div>
  )
}
