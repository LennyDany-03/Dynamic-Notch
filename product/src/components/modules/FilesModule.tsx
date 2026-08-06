import FileShelf from '../fileshelf/FileShelf'
import QuickNotes from '../notes/QuickNotes'
import type { FileShelfState } from '../../hooks/useFileShelf'
import { color } from '../../tokens'

/** Design state 04 — File Shelf and Quick Notes, split by a vertical hairline. */
export default function FilesModule({ shelf }: { shelf: FileShelfState }) {
  return (
    <div style={{ width: '100%', height: '100%', padding: 16, display: 'flex' }}>
      <FileShelf shelf={shelf} />
      <div style={{ width: 1, background: color.dividerStrong, flex: 'none' }} />
      <QuickNotes />
    </div>
  )
}
