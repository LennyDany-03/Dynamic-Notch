import { useEffect, useRef, useState } from 'react'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { color, radius, sectionLabel } from '../../tokens'
import { noteTitle, useQuickNotes } from '../../hooks/useQuickNotes'

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

/**
 * Quick Notes — the right pane of the file shelf card.
 *
 * **Redesigned from the export's single borderless textarea**, which had two
 * problems that only showed up in use. It was four lines tall, so anything longer
 * than a phone number scrolled inside a box the size of a phone number. And every
 * note past the first was unreachable: `+` made a new one and the old ones went
 * into the file, correctly, and then nowhere at all — the pane only ever drew
 * `notes[0]`.
 *
 * So: a list rail down the left, the editor beside it, and a full-card expansion
 * for when the editor is not enough. The rail is deliberately narrow and titled
 * from each note's own first line (`noteTitle`) rather than from a title field —
 * asking someone to name a thought before they can write it down is the friction
 * this module exists to remove.
 *
 * The expansion is a sheet *inside* the card, in the same way `NotificationDetail`
 * is, and for the same hard reason: anything drawn outside the card's own rect
 * sits on a click-through region, so a panel hanging below would take no clicks
 * and the notch would collapse the moment the cursor moved onto it.
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
  const [hovered, setHovered] = useState<string | null>(null)

  /**
   * "Saved" after typing stops.
   *
   * The pane autosaves and always has, and the export said so nowhere — which is
   * fine right up until someone asks where the file is (which is what put the
   * path in Settings). A note that says nothing about saving invites the question
   * "did that save?", and the honest answer is a word on screen rather than a
   * button that pretends the user has a choice.
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

  // Focus a freshly added note so "+" is immediately useful.
  useEffect(() => {
    if (previousId.current !== null && activeId !== previousId.current) {
      inputRef.current?.focus()
    }
    previousId.current = activeId
  }, [activeId])

  // Expanding is a request to write, so the caret goes where the writing happens.
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

  const header = (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        height: 22,
        flex: 'none',
      }}
    >
      <span style={sectionLabel}>{expanded ? 'Note' : 'Quick notes'}</span>

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

      <button
        type="button"
        aria-label={expanded ? 'Collapse the note' : 'Expand the note'}
        title={expanded ? 'Back to the shelf' : 'Give the note the whole card'}
        onClick={() => onExpandedChange(!expanded)}
        style={{
          width: 22,
          height: 22,
          flex: 'none',
          display: 'grid',
          placeItems: 'center',
          padding: 0,
          borderRadius: radius.small,
          background: color.tile,
        }}
      >
        <svg
          viewBox="0 0 24 24"
          width={12}
          height={12}
          fill="none"
          stroke={color.text.icon}
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
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
        </svg>
      </button>

      <button
        type="button"
        aria-label="New note"
        title="New note"
        onClick={addNote}
        style={{
          width: 22,
          height: 22,
          flex: 'none',
          display: 'grid',
          placeItems: 'center',
          padding: 0,
          borderRadius: radius.small,
          background: color.accent,
        }}
      >
        <svg viewBox="0 0 24 24" width={13} height={13} fill="none" stroke="#fff" strokeWidth={2} strokeLinecap="round">
          <path d="M12 6v12M6 12h12" />
        </svg>
      </button>
    </div>
  )

  /* ── Expanded: the editor takes the card, the rail becomes a strip ───────── */
  if (expanded) {
    return (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
        {header}
        <div style={{ height: 10, flex: 'none' }} />
        {editor}
      </div>
    )
  }

  /* ── Inline: list rail beside the editor ─────────────────────────────────── */
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

      <div style={{ height: 10, flex: 'none' }} />

      <div style={{ flex: 1, minHeight: 0, display: 'flex', gap: 10 }}>
        {/* The rail. Only drawn once there is a choice to make — a single note
            beside a list of one is a control that does nothing. */}
        {notes.length > 1 && (
          <div
            style={{
              width: 62,
              flex: 'none',
              minHeight: 0,
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
            }}
          >
            {notes.map((note) => {
              const active = note.id === activeId
              return (
                <button
                  key={note.id}
                  type="button"
                  title={noteTitle(note)}
                  onClick={() => selectNote(note.id)}
                  onContextMenu={(event) => {
                    event.preventDefault()
                    deleteNote(note.id)
                  }}
                  onPointerEnter={() => setHovered(note.id)}
                  onPointerLeave={() => setHovered(null)}
                  style={{
                    flex: 'none',
                    height: 30,
                    padding: '0 6px',
                    textAlign: 'left',
                    borderRadius: radius.small,
                    fontSize: 9.5,
                    lineHeight: 1.25,
                    color: active ? color.text.strong : color.text.muted,
                    background: active
                      ? color.accentWash
                      : hovered === note.id
                        ? color.tile
                        : 'transparent',
                    // Two lines of a first line, clamped — enough to tell two
                    // notes apart at 62px without pretending to be a preview.
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                    transition: 'background 90ms linear, color 90ms linear',
                  }}
                >
                  {noteTitle(note)}
                </button>
              )
            })}
          </div>
        )}

        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          {editor}
        </div>
      </div>
    </div>
  )
}
