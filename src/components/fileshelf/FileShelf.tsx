import { useRef } from 'react'
import { invoke } from '@tauri-apps/api/core'
import type { FileShelfState } from '../../hooks/useFileShelf'
import { color, radius, sectionLabel } from '../../tokens'

/** Movement before a press counts as a drag rather than a click. */
const DRAG_THRESHOLD_PX = 6

const isTauri = () => !!(window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__

/**
 * File Shelf — left pane of design state 04.
 *
 * Drop-in works. Dragging an item back *out* into another app still does not:
 * that needs a real OLE drag source (`IDropSource`/`IDataObject`) driven from a
 * native thread, which the webview cannot provide at all.
 */
export default function FileShelf({ shelf }: { shelf: FileShelfState }) {
  const { items, dragging, remove, open } = shelf

  // A press that turns into a drag hands off to the native OLE drag source; a
  // press that does not is an ordinary click that opens the file.
  const pressOrigin = useRef<{ x: number; y: number } | null>(null)
  const draggedOut = useRef(false)

  const beginPress = (x: number, y: number) => {
    pressOrigin.current = { x, y }
    draggedOut.current = false
  }

  const maybeStartDrag = (path: string, x: number, y: number) => {
    const origin = pressOrigin.current
    if (!origin || draggedOut.current) return
    if (Math.hypot(x - origin.x, y - origin.y) < DRAG_THRESHOLD_PX) return

    // SHDoDragDrop takes over the mouse, so this has to fire while the button is
    // still down — hence the move threshold rather than waiting for release.
    draggedOut.current = true
    pressOrigin.current = null
    if (isTauri()) {
      invoke('start_drag_out', { paths: [path] }).catch((err) =>
        console.error('shelf: drag out failed', err),
      )
    }
  }

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        minWidth: 0,
        paddingRight: 16,
      }}
    >
      <div
        style={{
          ...sectionLabel,
          marginBottom: 10,
          flex: 'none',
          display: 'flex',
          justifyContent: 'space-between',
        }}
      >
        <span>File shelf</span>
        {items.length > 0 && <span style={{ opacity: 0.7 }}>{items.length}</span>}
      </div>

      <div
        style={{
          flex: 1,
          minHeight: 0,
          borderRadius: radius.tile,
          border: `1px dashed ${dragging ? color.accent : color.dashed}`,
          background: dragging ? 'rgba(124,58,237,.08)' : 'transparent',
          transition: 'border-color 140ms ease, background 140ms ease',
          padding: 12,
          display: 'flex',
          gap: 14,
          alignItems: 'flex-start',
          overflowX: 'auto',
          overflowY: 'hidden',
        }}
      >
        {items.length === 0 ? (
          <span
            style={{
              fontSize: 11,
              color: color.text.muted,
              margin: 'auto',
              textAlign: 'center',
            }}
          >
            {dragging ? 'Release to shelve' : 'Drop files here'}
          </span>
        ) : (
          items.map((item) => (
            <div key={item.path} style={{ width: 48, flex: 'none', textAlign: 'center' }}>
              <button
                type="button"
                title={`${item.path}\n\nDrag out to another app · click to open · right-click to remove`}
                onPointerDown={(e) => beginPress(e.clientX, e.clientY)}
                onPointerMove={(e) => maybeStartDrag(item.path, e.clientX, e.clientY)}
                onPointerUp={() => {
                  pressOrigin.current = null
                }}
                onClick={() => {
                  // Suppressed when the press became a drag.
                  if (draggedOut.current) return
                  open(item)
                }}
                onContextMenu={(e) => {
                  e.preventDefault()
                  remove(item.path)
                }}
                style={{
                  height: 48,
                  width: 48,
                  borderRadius: radius.small,
                  background: color.tile,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 0,
                }}
              >
                <svg viewBox="0 0 24 24" width={22} height={22} fill="none" stroke={color.text.body} strokeWidth={1.5} strokeLinejoin="round">
                  <path d="M7 3h7l4 4v14H7z" />
                  <path d="M14 3v4h4" />
                </svg>
              </button>
              <div
                style={{
                  fontSize: 10,
                  color: color.text.secondary,
                  marginTop: 6,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {item.name}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
