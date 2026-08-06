import { useRef } from 'react'
import type { FileShelfState } from '../../hooks/useFileShelf'
import { color, radius, sectionLabel } from '../../tokens'

/**
 * File Shelf — left pane of design state 04.
 *
 * The shelf stores references: drag a tile to another desktop app to transfer
 * the original file, or click it to open it.
 */
export default function FileShelf({ shelf }: { shelf: FileShelfState }) {
  const { items, dragging, remove, open, startDrag } = shelf
  const nativeDragStarted = useRef(false)
  const pointerOrigin = useRef<{ x: number; y: number } | null>(null)

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
                title={`${item.path}\n\nDrag to another app · click to open · right-click to remove`}
                onPointerDown={(event) => {
                  if (event.button !== 0) return
                  nativeDragStarted.current = false
                  pointerOrigin.current = { x: event.clientX, y: event.clientY }
                }}
                onPointerMove={(event) => {
                  const origin = pointerOrigin.current
                  if (!origin || nativeDragStarted.current || !(event.buttons & 1)) return
                  // Preserve a normal click-to-open; hand off only after the
                  // pointer has moved far enough to be an intentional drag.
                  if (Math.hypot(event.clientX - origin.x, event.clientY - origin.y) < 5) return
                  // The shell owns the mouse from here. This stays set until the
                  // next press, so the release that ends the drag is not read as
                  // a click that would open the file.
                  nativeDragStarted.current = true
                  pointerOrigin.current = null
                  startDrag(item)
                }}
                onPointerUp={() => { pointerOrigin.current = null }}
                onClick={() => {
                  if (!nativeDragStarted.current) open(item)
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
