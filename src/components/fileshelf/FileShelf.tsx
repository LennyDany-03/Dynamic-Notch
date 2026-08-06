import type { FileShelfState } from '../../hooks/useFileShelf'
import { color, radius, sectionLabel } from '../../tokens'

/**
 * File Shelf — left pane of design state 04.
 *
 * Drop-in works. Dragging an item back *out* into another app still does not:
 * that needs a real OLE drag source (`IDropSource`/`IDataObject`) driven from a
 * native thread, which the webview cannot provide at all.
 */
export default function FileShelf({ shelf }: { shelf: FileShelfState }) {
  const { items, dragging, remove, open } = shelf

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
                title={`${item.path}\n\nClick to open · right-click to remove`}
                onClick={() => open(item)}
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
