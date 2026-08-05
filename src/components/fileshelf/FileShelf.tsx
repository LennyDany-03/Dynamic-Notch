import { color, radius, sectionLabel } from '../../tokens'

/**
 * File Shelf — left pane of design state 04.
 *
 * Stub. Drop-in and drag-out both belong to feature 5; drag-out in particular
 * needs a native OLE drag source (`IDropSource`/`IDataObject`) that the webview
 * cannot provide. Only the empty state is rendered for now.
 */
export default function FileShelf() {
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
      <div style={{ ...sectionLabel, marginBottom: 10, flex: 'none' }}>File shelf</div>
      <div
        style={{
          flex: 1,
          minHeight: 0,
          borderRadius: radius.tile,
          border: `1px dashed ${color.dashed}`,
          padding: 12,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <span style={{ fontSize: 11, color: color.text.muted, textAlign: 'center' }}>
          Drop files here
        </span>
      </div>
    </div>
  )
}
