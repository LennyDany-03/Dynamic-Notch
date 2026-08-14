import { useEffect, useRef, useState } from 'react'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { relativeTime } from '../../hooks/useClipboardHistory'
import { noteTitle, useQuickNotes, type Note } from '../../hooks/useQuickNotes'
import { color, radius, sectionLabel } from '../../tokens'

const isTauri = () => !!(window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__

/**
 * The overlay window is created with `focus: false` so it never steals activation
 * from whatever the user is working in. That also means it does not receive
 * keystrokes until something asks for focus — which typing into a note requires.
 */
const requestWindowFocus = () => {
  if (!isTauri()) return
  getCurrentWindow().setFocus().catch(() => {})
}

/** How long "Saved" stays up after the last keystroke settles. */
const SAVED_FLASH_MS = 1600

/* ── Fixed boxes. The card is a fixed size; see `size.files`. ──────────────── */
const HEADER_H = 22
const SWITCHER_H = 22
/** The note list in the expanded view. Narrow enough to leave the editor room. */
const LIST_W = 132

/**
 * Quick Notes.
 *
 * **Redesigned twice, and the second time is the interesting one.** The export
 * drew a single borderless textarea, which could only ever show `notes[0]` — every
 * note past the first was unreachable. The fix for that was a list rail down the
 * left of the pane, and it was worse: the pane is 210px wide, so the rail got 62
 * of them, which is not enough for a title. "flip-bottle-of-water" wrapped to two
 * clipped lines, the active row read as a heavy dark chip rather than a
 * selection, and the editor was left with 138px to type in.
 *
 * The mistake was using the same shape at both sizes. So now the two views are
 * genuinely different controls over the same notes:
 *
 *  - **Inline** (210px): the editor gets the *whole* pane, and switching notes is
 *    a horizontal strip of chips above it. Titles run along the strip where there
 *    is room for them instead of down a column where there is not, and the strip
 *    only exists when there is more than one note to switch between.
 *  - **Expanded** (the full 408px card): a proper list beside the editor — title,
 *    when it was last touched, and a delete that is visible rather than a
 *    right-click you had to know about.
 *
 * The expansion is a swap inside a fixed card, not a bigger card: anything drawn
 * outside the card's own rect sits on a click-through region and would take no
 * clicks. See `FilesModule`.
 */
export default function QuickNotes({
  expanded,
  onExpandedChange,
}: {
  /** Whether the editor has taken the whole card. Owned by `FilesModule`. */
  expanded: boolean
  onExpandedChange: (expanded: boolean) => void
}) {
  const { activeNote, activeId, notes, loaded, updateActive, addNote, selectNote, deleteNote } =
    useQuickNotes()

  const inputRef = useRef<HTMLTextAreaElement>(null)
  const previousId = useRef<string | null>(null)

  /**
   * "Saved" after typing stops.
   *
   * The pane autosaves and always has, and said so nowhere — which is fine right
   * up until someone asks where the file is (which is what put the path in
   * Settings). A note that says nothing about saving invites "did that save?",
   * and the honest answer is a word on screen rather than a button that pretends
   * the user has a choice.
   */
  const [saved, setSaved] = useState(false)
  const body = activeNote?.body ?? ''
  useEffect(() => {
    if (!loaded || body.length === 0) return
    setSaved(false)
    // Comfortably longer than the hook's 400ms autosave debounce, so the word
    // appears after the write rather than alongside it.
    const settle = setTimeout(() => setSaved(true), 600)
    const clear = setTimeout(() => setSaved(false), 600 + SAVED_FLASH_MS)
    return () => {
      clearTimeout(settle)
      clearTimeout(clear)
    }
  }, [body, loaded])

  // Focus a freshly added note so "+" is immediately useful, and focus on expand
  // because expanding is a request to write.
  useEffect(() => {
    if (previousId.current !== null && activeId !== previousId.current) {
      inputRef.current?.focus()
    }
    previousId.current = activeId
  }, [activeId])

  useEffect(() => {
    if (expanded) inputRef.current?.focus()
  }, [expanded])

  const editor = (
    <textarea
      ref={inputRef}
      value={body}
      onChange={(event) => updateActive(event.target.value)}
      onPointerDown={requestWindowFocus}
      disabled={!loaded}
      placeholder={loaded ? 'Jot something down…' : ''}
      spellCheck={false}
      style={{
        flex: 1,
        minHeight: 0,
        width: '100%',
        resize: 'none',
        border: 'none',
        outline: 'none',
        padding: 0,
        background: 'transparent',
        fontFamily: 'inherit',
        fontSize: 12,
        lineHeight: 1.55,
        color: color.text.body,
        caretColor: color.accent,
        // index.css disables selection globally for the overlay chrome; the one
        // place the user genuinely types has to opt back in.
        userSelect: 'text',
        WebkitUserSelect: 'text',
      }}
    />
  )

  const iconButton = (
    label: string,
    title: string,
    onClick: () => void,
    accent: boolean,
    children: React.ReactNode,
  ) => (
    <button
      type="button"
      aria-label={label}
      title={title}
      onClick={onClick}
      style={{
        width: HEADER_H,
        height: HEADER_H,
        flex: 'none',
        display: 'grid',
        placeItems: 'center',
        padding: 0,
        borderRadius: radius.small,
        background: accent ? color.accent : color.tile,
      }}
    >
      {children}
    </button>
  )

  const header = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, height: HEADER_H, flex: 'none' }}>
      <span style={sectionLabel}>{expanded ? 'Notes' : 'Quick notes'}</span>

      {/* Occupies the gap rather than shifting the buttons: the word comes and
          goes on a timer, and controls that moved with it would be a moving
          target every time the user stopped typing. */}
      <span
        style={{
          flex: 1,
          minWidth: 0,
          fontSize: 9.5,
          color: color.text.muted,
          opacity: saved ? 1 : 0,
          transition: 'opacity 200ms ease',
        }}
      >
        Saved
      </span>

      {iconButton(
        expanded ? 'Collapse the notes' : 'Expand the notes',
        expanded ? 'Back to the shelf' : 'Give notes the whole card',
        () => onExpandedChange(!expanded),
        false,
        <svg viewBox="0 0 24 24" width={12} height={12} fill="none" stroke={color.text.icon} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
          {expanded ? (
            <>
              <path d="M9 4v5H4M15 20v-5h5" />
              <path d="M4 20l5-5M20 4l-5 5" />
            </>
          ) : (
            <>
              <path d="M15 4h5v5M9 20H4v-5" />
              <path d="M20 4l-6 6M4 20l6-6" />
            </>
          )}
        </svg>,
      )}

      {iconButton('New note', 'New note', addNote, true,
        <svg viewBox="0 0 24 24" width={13} height={13} fill="none" stroke="#fff" strokeWidth={2} strokeLinecap="round">
          <path d="M12 6v12M6 12h12" />
        </svg>,
      )}
    </div>
  )

  /* ── Expanded: a real list beside the editor ─────────────────────────────── */
  if (expanded) {
    return (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
        {header}
        <div style={{ height: 10, flex: 'none' }} />

        <div style={{ flex: 1, minHeight: 0, display: 'flex', gap: 12 }}>
          <div
            style={{
              width: LIST_W,
              flex: 'none',
              minHeight: 0,
              overflowY: 'auto',
              paddingRight: 2,
            }}
          >
            {notes.map((note) => (
              <NoteRow
                key={note.id}
                note={note}
                active={note.id === activeId}
                onSelect={() => selectNote(note.id)}
                onDelete={() => deleteNote(note.id)}
              />
            ))}
          </div>

          <div style={{ width: 1, background: color.divider, flex: 'none' }} />

          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
            {editor}
          </div>
        </div>
      </div>
    )
  }

  /* ── Inline: the editor gets the whole pane ──────────────────────────────── */
  return (
    <div
      style={{
        width: 210,
        flex: 'none',
        display: 'flex',
        flexDirection: 'column',
        paddingLeft: 16,
        minHeight: 0,
      }}
    >
      {header}

      <div style={{ height: 8, flex: 'none' }} />

      {/* Only with something to switch between. One note beside a switcher
          holding one chip is a control that does nothing. */}
      {notes.length > 1 && (
        <>
          <NoteChips
            notes={notes}
            activeId={activeId}
            onSelect={selectNote}
            onDelete={deleteNote}
          />
          <div style={{ height: 8, flex: 'none' }} />
        </>
      )}

      {editor}
    </div>
  )
}

/**
 * The inline switcher: one scrolling row of chips.
 *
 * Horizontal because the titles are. A 62px column made "flip-bottle-of-water"
 * into two clipped lines; a chip strip gives each title as much width as it needs
 * and lets the row scroll, which is the axis a title actually runs along.
 *
 * Deleting is a middle-click or a right-click here rather than an × on every
 * chip: at 20px tall a close button is most of the chip, and the strip is meant
 * to be scanned. The expanded list is where deleting is a visible button.
 */
function NoteChips({
  notes,
  activeId,
  onSelect,
  onDelete,
}: {
  notes: Note[]
  activeId: string | null
  onSelect: (id: string) => void
  onDelete: (id: string) => void
}) {
  const strip = useRef<HTMLDivElement>(null)

  // Keep the selection in view. With seven notes the active one is often off the
  // end of the strip after a delete, and a switcher that does not show what is
  // selected is not a switcher.
  useEffect(() => {
    const el = strip.current?.querySelector<HTMLElement>('[data-active="true"]')
    el?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [activeId, notes.length])

  return (
    <div
      ref={strip}
      style={{
        height: SWITCHER_H,
        flex: 'none',
        display: 'flex',
        gap: 5,
        overflowX: 'auto',
        // The chips must not squash to fit; the strip scrolls instead.
        flexWrap: 'nowrap',
      }}
    >
      {notes.map((note) => {
        const active = note.id === activeId
        return (
          <button
            key={note.id}
            type="button"
            data-active={active}
            title={`${noteTitle(note)}\n\nRight-click to delete`}
            onClick={() => onSelect(note.id)}
            onAuxClick={(event) => {
              if (event.button === 1) onDelete(note.id)
            }}
            onContextMenu={(event) => {
              event.preventDefault()
              onDelete(note.id)
            }}
            style={{
              flex: 'none',
              maxWidth: 92,
              height: SWITCHER_H,
              padding: '0 9px',
              borderRadius: radius.pill,
              fontSize: 10,
              fontWeight: active ? 600 : 400,
              // The accent fills the active chip rather than tinting it. At this
              // size a faint wash is indistinguishable from the tile behind it,
              // which is what made the old rail's selection unreadable.
              color: active ? '#fff' : color.text.secondary,
              background: active ? color.accent : color.tile,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              transition: 'background 120ms ease, color 120ms ease',
            }}
          >
            {noteTitle(note)}
          </button>
        )
      })}
    </div>
  )
}

/** One row of the expanded list: title, when it was touched, and a delete. */
function NoteRow({
  note,
  active,
  onSelect,
  onDelete,
}: {
  note: Note
  active: boolean
  onSelect: () => void
  onDelete: () => void
}) {
  const [hovered, setHovered] = useState(false)

  return (
    <div
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        height: 38,
        marginBottom: 2,
        borderRadius: radius.small,
        background: active ? color.accentWash : hovered ? color.tile : 'transparent',
        transition: 'background 90ms linear',
      }}
    >
      {/* A bar rather than a fill for the selection: the row already has a wash,
          and at this size an edge marker is what the eye finds first. */}
      <span
        style={{
          position: 'absolute',
          left: 0,
          top: 7,
          bottom: 7,
          width: 2,
          borderRadius: 2,
          background: active ? color.accent : 'transparent',
        }}
      />

      <button
        type="button"
        onClick={onSelect}
        title={noteTitle(note)}
        style={{
          flex: 1,
          minWidth: 0,
          height: '100%',
          padding: '0 6px 0 10px',
          textAlign: 'left',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          gap: 1,
        }}
      >
        <span
          style={{
            fontSize: 11,
            fontWeight: active ? 600 : 400,
            color: active ? color.text.primary : color.text.strong,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            width: '100%',
          }}
        >
          {noteTitle(note)}
        </span>
        <span style={{ fontSize: 9, color: color.text.muted }}>
          {relativeTime(note.updatedAt)}
        </span>
      </button>

      {/* On hover only, and in a fixed-width slot so the title does not reflow
          when it appears. */}
      <span style={{ width: 22, flex: 'none', display: 'flex', justifyContent: 'center' }}>
        {hovered && (
          <button
            type="button"
            onClick={onDelete}
            aria-label={`Delete ${noteTitle(note)}`}
            title="Delete this note"
            style={{
              width: 18,
              height: 18,
              display: 'grid',
              placeItems: 'center',
              padding: 0,
              borderRadius: radius.small,
              background: 'rgba(248,113,113,.14)',
            }}
          >
            <svg viewBox="0 0 24 24" width={10} height={10} fill="none" stroke={color.fileRed} strokeWidth={2.4} strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        )}
      </span>
    </div>
  )
}
