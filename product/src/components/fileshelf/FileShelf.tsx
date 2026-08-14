import { useRef, useState } from 'react'
import type { FileShelfState } from '../../hooks/useFileShelf'
import { color, radius, sectionLabel } from '../../tokens'

/**
 * File Shelf — the left pane of the file shelf and notes card.
 *
 * Somewhere to park a file on its way from one app to another: drag a tile out to
 * transfer the original, click to open it, and it holds a reference rather than a
 * copy, so nothing here takes disk space or goes stale.
 *
 * **Redesigned from the export's single scrolling row.** Three things were wrong
 * with it once the card grew. It was one row that scrolled sideways, so the fifth
 * file onward was off-screen with nothing saying so; every file drew the same
 * generic page glyph, which makes a shelf of six files a shelf of six identical
 * squares; and removing one was a right-click with no affordance anywhere — a
 * gesture you either knew about or did not.
 *
 * Now: a wrapping grid, an extension chip on each tile, and a remove button that
 * appears on hover. The right-click still works, because it was in the tooltip and
 * someone will have learned it.
 */

/**
 * File type → the colour of its chip.
 *
 * Kept deliberately short. This is not a file manager and a tile is 52px: the
 * point is to tell *this* PDF from *that* screenshot at a glance while dragging,
 * which needs about five buckets, not forty. Everything unlisted takes the
 * neutral grey, which is honest — Crest has nothing to say about `.dwg`.
 *
 * The colours are literals rather than accent-derived on purpose: they mean "this
 * is a document", not "this is active", and following the user's accent would
 * make every tile the same colour again, which is the thing being fixed.
 */
const KINDS: { match: RegExp; tint: string; label: string }[] = [
  { match: /\.(pdf)$/i, tint: '#F87171', label: 'PDF' },
  { match: /\.(png|jpe?g|gif|webp|bmp|svg|avif|heic)$/i, tint: '#60A5FA', label: 'Image' },
  { match: /\.(mp4|mov|mkv|avi|webm|m4v)$/i, tint: '#C084FC', label: 'Video' },
  { match: /\.(mp3|wav|flac|m4a|ogg|aac)$/i, tint: '#34D399', label: 'Audio' },
  { match: /\.(zip|rar|7z|tar|gz|xz)$/i, tint: '#FBBF24', label: 'Archive' },
  { match: /\.(docx?|xlsx?|pptx?|txt|md|rtf|csv)$/i, tint: '#38BDF8', label: 'Doc' },
]

function describe(name: string): { tint: string; ext: string } {
  const kind = KINDS.find((candidate) => candidate.match.test(name))
  const dot = name.lastIndexOf('.')
  // Four characters covers `.jpeg` and `.docx`; anything longer is a name with a
  // dot in it rather than an extension, and gets the folder-ish fallback.
  const raw = dot > 0 && dot < name.length - 1 ? name.slice(dot + 1) : ''
  return {
    tint: kind?.tint ?? color.text.icon,
    ext: raw.length > 0 && raw.length <= 4 ? raw.toUpperCase() : 'FILE',
  }
}

function Tile({
  item,
  onOpen,
  onRemove,
  onDragOut,
}: {
  item: FileShelfState['items'][number]
  onOpen: () => void
  onRemove: () => void
  onDragOut: () => void
}) {
  const [hovered, setHovered] = useState(false)
  const nativeDragStarted = useRef(false)
  const pointerOrigin = useRef<{ x: number; y: number } | null>(null)
  const { tint, ext } = describe(item.name)

  return (
    <div
      style={{ width: 52, flex: 'none', position: 'relative' }}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
    >
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
          // Preserve a normal click-to-open; hand off only after the pointer has
          // moved far enough to be an intentional drag.
          if (Math.hypot(event.clientX - origin.x, event.clientY - origin.y) < 5) return
          // The shell owns the mouse from here. This stays set until the next
          // press, so the release that ends the drag is not read as a click that
          // would open the file.
          nativeDragStarted.current = true
          pointerOrigin.current = null
          onDragOut()
        }}
        onPointerUp={() => {
          pointerOrigin.current = null
        }}
        onClick={() => {
          if (!nativeDragStarted.current) onOpen()
        }}
        onContextMenu={(event) => {
          event.preventDefault()
          onRemove()
        }}
        style={{
          width: 52,
          height: 52,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 3,
          padding: 0,
          borderRadius: radius.tile,
          background: hovered ? color.hoverStrong : color.tile,
          transition: 'background 90ms linear',
        }}
      >
        <svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke={tint} strokeWidth={1.5} strokeLinejoin="round">
          <path d="M7 3h7l4 4v14H7z" />
          <path d="M14 3v4h4" />
        </svg>

        {/* The extension, not an icon per format. It is the shortest true thing
            about the file and it is what the user recognises their own file by. */}
        <span
          style={{
            fontSize: 7.5,
            fontWeight: 700,
            letterSpacing: '.06em',
            color: tint,
            lineHeight: 1,
          }}
        >
          {ext}
        </span>
      </button>

      {hovered && (
        <button
          type="button"
          aria-label={`Remove ${item.name}`}
          title="Remove from the shelf"
          onClick={onRemove}
          style={{
            position: 'absolute',
            top: -4,
            right: -4,
            width: 16,
            height: 16,
            display: 'grid',
            placeItems: 'center',
            padding: 0,
            borderRadius: '50%',
            background: 'rgba(20,20,20,.92)',
            boxShadow: `0 0 0 1px ${color.dividerStrong}`,
          }}
        >
          <svg viewBox="0 0 24 24" width={9} height={9} fill="none" stroke={color.text.secondary} strokeWidth={2.6} strokeLinecap="round">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      )}

      <div
        style={{
          fontSize: 9.5,
          color: color.text.secondary,
          marginTop: 4,
          textAlign: 'center',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {item.name}
      </div>
    </div>
  )
}

export default function FileShelf({ shelf }: { shelf: FileShelfState }) {
  const { items, dragging, remove, open, startDrag } = shelf

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
          height: 22,
          flex: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <span>File shelf</span>
        {items.length > 0 && <span style={{ opacity: 0.7 }}>{items.length}</span>}
      </div>

      <div style={{ height: 10, flex: 'none' }} />

      <div
        style={{
          flex: 1,
          minHeight: 0,
          borderRadius: radius.tile,
          border: `1px dashed ${dragging ? color.accent : color.dashed}`,
          background: dragging ? color.accentWashSoft : 'transparent',
          transition: 'border-color 140ms ease, background 140ms ease',
          // 10 rather than 12, and the same for the gap: two rows of tiles have
          // to fit the 170px this box gets at `size.files`'s 260, and at 12 the
          // second row's caption clipped by a few pixels. Anything past two rows
          // scrolls, which is the right trade — the shelf is a staging area, and
          // a dozen files parked in it is a folder.
          padding: 10,
          // Wraps rather than scrolling sideways: a horizontal scroller hides its
          // own contents, which is what the export's single row did.
          display: 'flex',
          flexWrap: 'wrap',
          alignContent: 'flex-start',
          gap: 10,
          overflowY: 'auto',
        }}
      >
        {items.length === 0 ? (
          <span
            style={{
              fontSize: 11,
              lineHeight: 1.5,
              color: color.text.muted,
              margin: 'auto',
              textAlign: 'center',
            }}
          >
            {dragging ? (
              'Release to shelve'
            ) : (
              <>
                Drop files here
                <br />
                <span style={{ fontSize: 10, opacity: 0.8 }}>
                  then drag them out wherever they need to go
                </span>
              </>
            )}
          </span>
        ) : (
          items.map((item) => (
            <Tile
              key={item.path}
              item={item}
              onOpen={() => open(item)}
              onRemove={() => remove(item.path)}
              onDragOut={() => startDrag(item)}
            />
          ))
        )}
      </div>
    </div>
  )
}
