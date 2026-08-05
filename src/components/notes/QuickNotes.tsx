import { useEffect, useRef } from 'react'
import { color, radius, sectionLabel } from '../../tokens'
import { useQuickNotes } from '../../hooks/useQuickNotes'

/**
 * Quick Notes — the right pane of the File Shelf + Notes card (design state 04).
 *
 * Borderless and autosaving, per the design annotation. The design mocks a text
 * caret with a blinking span; a real textarea has a real caret, so that is done
 * with `caret-color` instead.
 */
export default function QuickNotes() {
  const { activeNote, loaded, updateActive, addNote } = useQuickNotes()
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const noteId = activeNote?.id ?? null
  const previousId = useRef<string | null>(null)

  // Focus a freshly added note so "+" is immediately useful.
  useEffect(() => {
    if (previousId.current !== null && noteId !== previousId.current) {
      inputRef.current?.focus()
    }
    previousId.current = noteId
  }, [noteId])

  return (
    <div
      style={{
        width: 170,
        flex: 'none',
        display: 'flex',
        flexDirection: 'column',
        paddingLeft: 16,
        minHeight: 0,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 10,
          flex: 'none',
        }}
      >
        <span style={sectionLabel}>Quick notes</span>
        <button
          type="button"
          aria-label="New note"
          onClick={addNote}
          style={{
            width: 24,
            height: 24,
            borderRadius: radius.tile,
            background: color.accent,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 0,
            flex: 'none',
          }}
        >
          <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="#fff" strokeWidth={1.8} strokeLinecap="round">
            <path d="M12 6v12M6 12h12" />
          </svg>
        </button>
      </div>

      <textarea
        ref={inputRef}
        value={activeNote?.body ?? ''}
        onChange={(e) => updateActive(e.target.value)}
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
          lineHeight: 1.5,
          color: color.text.body,
          caretColor: color.accent,
          // index.css disables selection globally for the overlay chrome; the one
          // place the user genuinely types has to opt back in.
          userSelect: 'text',
          WebkitUserSelect: 'text',
        }}
      />
    </div>
  )
}
