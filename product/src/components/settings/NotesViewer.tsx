import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { relativeTime } from '../../hooks/useClipboardHistory'
import { noteTitle, useSavedNotes } from '../../hooks/useQuickNotes'
import { color, radius, sectionLabel, spring } from '../../tokens'

/**
 * Every saved note, as text.
 *
 * This replaces a "Show in Explorer" button, and the reason is worth writing
 * down: the path row answered "where did my notes go", and the honest answer was
 * a `.json` file. Following that button got you a folder, and opening the file
 * got you whatever Windows has registered for `.json` — usually nothing, and at
 * best a text editor showing `[{"id":"a3f…","body":"lost-in-space\nbgmi",…}]`.
 * That is the storage format, not the notes. Someone asking where their notes
 * are is asking to *read* them.
 *
 * So the button opens this instead: the same notes, rendered the way they were
 * typed. Escapes are unescaped, newlines are newlines, and each one carries when
 * it was last touched. The path is still on the row above for anyone who wants
 * the file itself.
 *
 * Read-only on purpose. Editing lives in the notch, and a second editor over the
 * same file would need a story about which one wins — the notch autosaves on a
 * 400ms debounce and would happily overwrite anything typed here.
 */

/** Enough for the longest note anyone jots in a notch, before the body scrolls. */
const CARD_W = 520

export default function NotesViewer({ onClose }: { onClose: () => void }) {
  const { notes, loaded, reload } = useSavedNotes()
  const [hovered, setHovered] = useState(false)

  // Read on open, every time. The window is hidden and reshown rather than
  // rebuilt, so a list captured on mount would be however old the session is.
  useEffect(() => {
    void reload()
  }, [reload])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // Newest first. The file is written in the order the notch keeps them, which is
  // also newest-first, but sorting here means the viewer does not depend on that.
  const ordered = [...notes].sort((a, b) => b.updatedAt - a.updatedAt)

  return (
    <div
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 20,
        display: 'grid',
        placeItems: 'center',
        padding: 24,
        // A scrim, so the settings window behind reads as parked rather than as
        // a second thing competing for attention.
        background: 'rgba(0,0,0,.45)',
      }}
    >
      <motion.div
        className="mica"
        role="dialog"
        aria-label="Saved notes"
        initial={{ opacity: 0, scale: 0.97, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={spring.expand}
        style={{
          width: '100%',
          maxWidth: CARD_W,
          maxHeight: '100%',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: radius.shell,
          boxShadow: '0 20px 60px rgba(0,0,0,.5)',
        }}
      >
        {/* Above .mica::before (noise) and .mica::after (hairline). */}
        <div
          style={{
            position: 'relative',
            zIndex: 1,
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0,
          }}
        >
          <header
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '14px 14px 12px 18px',
              flex: 'none',
            }}
          >
            <span style={{ fontSize: 14, fontWeight: 600, color: color.text.primary }}>
              Your notes
            </span>

            {loaded && notes.length > 0 && (
              <span
                style={{
                  padding: '1px 7px',
                  borderRadius: radius.pill,
                  background: color.tile,
                  fontSize: 10.5,
                  fontWeight: 600,
                  color: color.text.secondary,
                }}
              >
                {notes.length}
              </span>
            )}

            <span style={{ flex: 1 }} />

            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              title="Close"
              onPointerEnter={() => setHovered(true)}
              onPointerLeave={() => setHovered(false)}
              style={{
                width: 26,
                height: 26,
                display: 'grid',
                placeItems: 'center',
                padding: 0,
                borderRadius: radius.small,
                background: hovered ? color.tile : 'transparent',
                transition: 'background 90ms linear',
              }}
            >
              <svg viewBox="0 0 24 24" width={13} height={13} fill="none" stroke={color.text.secondary} strokeWidth={2} strokeLinecap="round">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </header>

          <div
            style={{
              flex: 1,
              minHeight: 0,
              overflowY: 'auto',
              padding: '0 18px 18px',
            }}
          >
            {!loaded ? null : ordered.length === 0 ? (
              <p
                style={{
                  margin: 0,
                  padding: '24px 0 28px',
                  textAlign: 'center',
                  fontSize: 12.5,
                  lineHeight: 1.6,
                  color: color.text.muted,
                }}
              >
                Nothing saved yet. Open the notch, find the file shelf card, and start
                typing — it saves itself.
              </p>
            ) : (
              ordered.map((note, index) => {
                const title = noteTitle(note)
                // The body minus the line already used as the heading, so a note
                // is not shown with its first line twice.
                const rest = note.body.replace(/^\s*\n*/, '').split('\n').slice(1).join('\n').trimEnd()

                return (
                  <article
                    key={note.id}
                    style={{
                      padding: '13px 0',
                      // Hairlines between rather than cards around: this is a
                      // document to read down, not a set of things to pick from.
                      boxShadow:
                        index === ordered.length - 1
                          ? undefined
                          : `inset 0 -1px 0 ${color.divider}`,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                      <h4
                        style={{
                          flex: 1,
                          minWidth: 0,
                          margin: 0,
                          fontSize: 13,
                          fontWeight: 600,
                          color: color.text.primary,
                          overflowWrap: 'anywhere',
                        }}
                      >
                        {title}
                      </h4>
                      <span style={{ ...sectionLabel, flex: 'none' }}>
                        {relativeTime(note.updatedAt)}
                      </span>
                    </div>

                    {rest.length > 0 && (
                      <p
                        style={{
                          margin: '6px 0 0',
                          fontSize: 12.5,
                          lineHeight: 1.6,
                          color: color.text.body,
                          // The whole point: the note as it was typed. Newlines
                          // are newlines and indentation survives, which is what
                          // a JSON dump could not do.
                          whiteSpace: 'pre-wrap',
                          overflowWrap: 'anywhere',
                          // Selectable, unlike the rest of this window's chrome —
                          // reading usually ends in copying a line out.
                          userSelect: 'text',
                          WebkitUserSelect: 'text',
                        }}
                      >
                        {rest}
                      </p>
                    )}
                  </article>
                )
              })
            )}
          </div>
        </div>
      </motion.div>
    </div>
  )
}
