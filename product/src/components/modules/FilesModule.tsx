import FileShelf from '../fileshelf/FileShelf'
import QuickNotes from '../notes/QuickNotes'
import type { FileShelfState } from '../../hooks/useFileShelf'
import { useStickyState } from '../../hooks/useStickyState'
import { color } from '../../tokens'

/**
 * The file shelf and quick notes, split by a vertical hairline — design state 04,
 * grown to the tallest card in the app (see `size.files`).
 *
 * The one piece of state here is whether the note has taken the whole card. It
 * lives at this level rather than inside `QuickNotes` because it decides what the
 * *card* is showing: the shelf is unmounted while the note is expanded, and a
 * component cannot reasonably reach out and hide its sibling.
 *
 * Unlike the notifications module's detail sheet, this does not change any
 * geometry — the card is a fixed 440×346 either way, so the state machine never
 * has to know about it. That is the whole reason the expansion is a swap inside a
 * fixed card rather than a bigger card: growing on expand would mean a rect that
 * changes size under a stationary cursor, which is the thing `contentRect`'s latch
 * exists to survive rather than something to go looking for.
 */
export default function FilesModule({ shelf }: { shelf: FileShelfState }) {
  // Sticky, because expanding the notes is a request to write and the writing is
  // what survives a collapse: coming back to the split view with the note you
  // were mid-sentence in shrunk into the right-hand pane is the same interruption
  // as losing the text, one step less severe.
  const [notesExpanded, setNotesExpanded] = useStickyState('files.notesExpanded', false)

  return (
    <div style={{ width: '100%', height: '100%', padding: 16, display: 'flex' }}>
      {!notesExpanded && (
        <>
          <FileShelf shelf={shelf} />
          <div style={{ width: 1, background: color.dividerStrong, flex: 'none' }} />
        </>
      )}

      <QuickNotes expanded={notesExpanded} onExpandedChange={setNotesExpanded} />
    </div>
  )
}
