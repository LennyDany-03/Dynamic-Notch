import { useRef, useState, type ReactNode } from 'react'
import { useScreenshotThumb, type ScreenshotFeed } from '../../hooks/useScreenshots'
import type { Screenshot } from '../../types/screenshots'
import { color, font, radius } from '../../tokens'

/**
 * The screenshot shelf — whatever you have captured lately, one hover away from
 * being dragged into something.
 *
 * The gap this fills is a specific one. A screenshot is taken *in order to put it
 * somewhere*, and the path from PrtScn to a chat window is: find the folder,
 * recognise the file by a name that is a timestamp, drag it. The notch already had
 * the two halves that shortcut that — a real OLE drag (`shelf.rs`) and shell
 * thumbnails (`icons.rs`) — and this is them pointed at the folder Windows was
 * saving to all along.
 *
 * It holds no state of its own and stores nothing: the list is a view over the
 * user's own folders, re-derived on every poll (see `screenshots.rs`). Which is
 * also why there is no "remove" here and no clear-all — there is nothing to remove
 * *from*. A tile leaves this card when the capture leaves the folder, and the only
 * way for the notch to make that happen would be to delete a user's file from a
 * surface that appears under their cursor when they reach for the top of the
 * screen. The three actions offered are the three that are safe: open it, drag it
 * out, or find it on disk.
 *
 * **It has no header of its own**, and that is a fix rather than an omission. It
 * shipped with a `Screenshots` section label under a nav strip that already reads
 * `‹ SCREENSHOTS ›` — the same word twice, eleven pixels apart, on a card whose
 * entire content is the grid. `SystemModule` does repeat its nav label and gets
 * away with it because its header carries the temperature beside it;
 * `QuickAccessModule` is the better precedent, whose header says "Audio routing"
 * rather than its own name. Here there was nothing to put in the left slot that
 * was not already on screen, so the row is gone and the 26px went to the tiles.
 *
 * Every box below is pinned to an explicit height, and the total is
 * `size.screenshots`: 26 nav + 12 padding + 101 + 8 + 101 + 12 padding = 260. A
 * row that measured itself would put the card and the rect the cursor is
 * hit-tested against out of step — see `layout.contentRect`.
 */

/**
 * Three columns, laid out by the grid rather than by a fixed tile width.
 *
 * It was four fixed 93s wrapping in a flex row, and that was wrong twice. The
 * arithmetic came to *exactly* the 396 of content width, so sub-pixel rounding
 * wrapped the fourth tile and the card silently drew three columns anyway — a
 * layout that depends on a rounding mode is a layout that will differ between
 * displays. And three is the better answer regardless: a screenshot is 16:9, and
 * at four columns the tile is squarer than the picture in it, so every capture was
 * letterboxed into about two-thirds of its own tile. `repeat(3, 1fr)` cannot
 * disagree with the card's width, whatever `panelScale` does to it.
 */
const COLUMNS = 3
const TILE_IMAGE_H = 81
const TILE_LABEL_H = 20
const TILE_H = TILE_IMAGE_H + TILE_LABEL_H
const GAP = 8

/**
 * "2 minutes ago" — the only honest label for a file whose real name is
 * `Screenshot 2026-08-17 143205.png`.
 *
 * The name is a timestamp already, which sounds like it makes this redundant and
 * does the opposite: a column of near-identical timestamps is unreadable at a
 * glance, and "which one did I just take" is the entire question being asked here.
 * The name is still on the tooltip, for the times the answer is "the one called
 * that".
 */
function ago(capturedAt: number): string {
  const seconds = Math.max(0, Math.round((Date.now() - capturedAt) / 1000))
  if (seconds < 60) return 'just now'

  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`

  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`

  return `${Math.round(hours / 24)}d ago`
}

function Tile({
  shot,
  onOpen,
  onDragOut,
  onReveal,
}: {
  shot: Screenshot
  onOpen: () => void
  onDragOut: () => void
  onReveal: () => void
}) {
  const [hovered, setHovered] = useState(false)
  const thumb = useScreenshotThumb(shot.path)

  // The same handshake `FileShelf` uses. A click and a drag begin identically, so
  // the gesture is decided by distance travelled rather than by which handler
  // fires first — and `nativeDragStarted` stays set until the next press, so the
  // release that *ends* a drag is not also read as a click that opens the file.
  const nativeDragStarted = useRef(false)
  const pointerOrigin = useRef<{ x: number; y: number } | null>(null)

  return (
    <button
      type="button"
      title={`${shot.name}\n\nDrag into another app · click to open · right-click to show in folder`}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      onPointerDown={(event) => {
        if (event.button !== 0) return
        nativeDragStarted.current = false
        pointerOrigin.current = { x: event.clientX, y: event.clientY }
      }}
      onPointerMove={(event) => {
        const origin = pointerOrigin.current
        if (!origin || nativeDragStarted.current || !(event.buttons & 1)) return
        if (Math.hypot(event.clientX - origin.x, event.clientY - origin.y) < 5) return
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
        // Stops `App`'s own handler opening the notch's context menu over the
        // card. The tile has a more specific answer to a right-click than "here
        // are the notch's options".
        event.preventDefault()
        event.stopPropagation()
        onReveal()
      }}
      style={{
        // Width comes from the grid column, so a card widened by `panelScale`
        // widens its tiles rather than leaving a gutter down the right.
        width: '100%',
        height: TILE_H,
        padding: 0,
        display: 'flex',
        flexDirection: 'column',
        borderRadius: radius.tile,
        overflow: 'hidden',
        background: hovered ? color.hoverStrong : color.tile,
        transition: 'background 90ms linear',
      }}
    >
      <span
        style={{
          height: TILE_IMAGE_H,
          flex: 'none',
          display: 'grid',
          placeItems: 'center',
          overflow: 'hidden',
          // A shade back from the tile so a screenshot of a white document still
          // reads as a picture sitting *in* something rather than as a hole.
          background: color.inset,
        }}
      >
        {thumb ? (
          <img
            src={thumb}
            alt=""
            // `contain`, not `cover`: a screenshot is 16:9 and the tile is not, so
            // filling the box would crop away one edge of every capture — and the
            // cropped edge is where the browser tab, the window title and the
            // error dialog live, i.e. the part you are identifying it by.
            style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', display: 'block' }}
            draggable={false}
          />
        ) : (
          // Not a spinner. The thumbnail resolves in a few tens of milliseconds
          // and a grid of eight spinners flickering out one by one is more motion
          // than the card can carry; a still glyph in the tile's own colour simply
          // fills the box until the picture replaces it.
          <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke={color.text.icon} strokeWidth={1.5} strokeLinejoin="round">
            <rect x="3" y="5" width="18" height="14" rx="2" />
            <circle cx="8.5" cy="10" r="1.5" />
            <path d="M4 17l4.5-4.5 3.5 3.5 3-3L20 17" />
          </svg>
        )}
      </span>

      <span
        style={{
          height: TILE_LABEL_H,
          flex: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '0 4px',
          fontSize: 9.5,
          color: hovered ? color.text.secondary : color.text.muted,
          whiteSpace: 'nowrap',
          transition: 'color 90ms linear',
        }}
      >
        {ago(shot.capturedAt)}
      </span>
    </button>
  )
}

export default function ScreenshotsModule({
  feed,
  enabled,
}: {
  feed: ScreenshotFeed
  /**
   * The "screenshots in the notch" preference.
   *
   * The card is gated on it as well as the banner, exactly as the notifications
   * module is: it is one switch for whether Crest looks at those folders at all,
   * and a grid that kept filling itself after the user said no would be a second,
   * silent answer to that question.
   */
  enabled: boolean
}) {
  const { shots, loaded, open, startDrag, reveal } = feed

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        // Even on all four sides now. It was `0` at the top to sit the old header
        // tight under the nav strip; with the header gone, a grid flush against the
        // chevrons would read as the tiles overflowing the card.
        padding: 12,
      }}
    >
      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: 'grid',
          gridTemplateColumns: `repeat(${COLUMNS}, 1fr)`,
          // Rows are sized rather than stretched: `1fr` rows would grow the two
          // visible tiles to fill the card whenever there were only two, so a
          // shelf holding one capture would draw it at twice everyone else's size.
          gridAutoRows: TILE_H,
          alignContent: 'start',
          gap: GAP,
          overflowY: 'auto',
        }}
      >
        {!enabled ? (
          <Empty>
            Screenshots are switched off.
            <Hint>Settings → Screenshots turns the watching back on.</Hint>
          </Empty>
        ) : !loaded ? (
          <Empty>Looking…</Empty>
        ) : shots.length === 0 ? (
          <Empty>
            Nothing captured yet.
            <Hint>
              Press <Key>Win</Key> <Key>Shift</Key> <Key>S</Key> and whatever you snip lands here.
            </Hint>
          </Empty>
        ) : (
          shots.map((shot) => (
            <Tile
              key={shot.path}
              shot={shot}
              onOpen={() => open(shot)}
              onDragOut={() => startDrag(shot)}
              onReveal={() => reveal(shot)}
            />
          ))
        )}
      </div>
    </div>
  )
}

function Empty({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        // Spans the whole grid and centres in it. Without the span it would be
        // laid into the first column and sit hard against the left edge, three
        // words wide.
        gridColumn: '1 / -1',
        margin: 'auto',
        textAlign: 'center',
        fontSize: 11.5,
        lineHeight: 1.55,
        color: color.text.muted,
      }}
    >
      {children}
    </div>
  )
}

function Hint({ children }: { children: ReactNode }) {
  return (
    <div style={{ marginTop: 6, fontSize: 10.5, opacity: 0.85 }}>{children}</div>
  )
}

/** A keycap, so the shortcut in the empty state reads as keys rather than as prose. */
function Key({ children }: { children: ReactNode }) {
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '1px 5px',
        margin: '0 1px',
        borderRadius: radius.small,
        background: color.tile,
        fontFamily: font.mono,
        fontSize: 9.5,
        color: color.text.secondary,
      }}
    >
      {children}
    </span>
  )
}
