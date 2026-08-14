import { useState } from 'react'
import { revealItemInDir } from '@tauri-apps/plugin-opener'
import RowShell from './RowShell'
import { useNotesLocation } from '../../hooks/useSettings'
import { color, radius } from '../../tokens'

/**
 * Where Quick Notes are written.
 *
 * There is no save button in the notes pane and there never has been — it
 * autosaves on a 400ms debounce — which is the right behaviour and also exactly
 * what raises the question this row answers: if nothing was clicked, where did it
 * go? A path on screen is the whole answer, and it is the answer people actually
 * want, because the next thing they do with it is back the file up or open it in
 * an editor.
 *
 * **Shows the folder rather than opening the file.** `revealItemInDir` puts
 * Explorer on the folder with `notes.json` selected; launching the file itself
 * would hand it to whatever is registered for `.json`, which on a default Windows
 * install is nothing.
 *
 * The path is deliberately not configurable. Moving it would mean owning a
 * migration — copy or move, what happens to the old file, what happens when the
 * new folder is on a drive that is not mounted at launch — and this is a few
 * kilobytes of text in the app-data folder every Windows app already uses.
 * Somebody who wants it somewhere else can symlink it, and now they know where.
 */
export default function NotesLocation() {
  const location = useNotesLocation()
  const [hovered, setHovered] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  if (!location) return null

  const copy = () => {
    void navigator.clipboard
      .writeText(location.file)
      .then(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 1600)
      })
      .catch(() => {})
  }

  const button = (id: string, label: string, onClick: () => void) => (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHovered(id)}
      onMouseLeave={() => setHovered(null)}
      style={{
        flex: 'none',
        height: 26,
        padding: '0 10px',
        borderRadius: radius.small,
        fontSize: 11.5,
        color: hovered === id ? color.text.primary : color.text.secondary,
        background: hovered === id ? 'rgba(255,255,255,.10)' : color.tile,
        transition: 'background 90ms linear, color 90ms linear',
      }}
    >
      {label}
    </button>
  )

  return (
    <RowShell
      title="Where notes are saved"
      body="Quick Notes save themselves as you type — there is no save button, and nothing is ever waiting to be written. This is the file they go into."
      icon={
        <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        </svg>
      }
    >
      <div
        style={{
          padding: '8px 10px',
          borderRadius: radius.small,
          background: color.inset,
          boxShadow: color.insetShadow,
          fontFamily: 'ui-monospace,Menlo,monospace',
          fontSize: 11,
          lineHeight: 1.5,
          color: color.text.body,
          // The path is the one string in this window worth selecting by hand.
          userSelect: 'text',
          WebkitUserSelect: 'text',
          wordBreak: 'break-all',
        }}
      >
        {location.file}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
        {button('reveal', 'Show in Explorer', () => {
          void revealItemInDir(location.exists ? location.file : location.directory).catch(() => {})
        })}
        {button('copy', copied ? 'Copied' : 'Copy path', copy)}

        {!location.exists && (
          // The folder exists — `notes_location` makes sure of it — but the file
          // only appears once something is typed. Saying so stops an empty folder
          // reading as the feature being broken.
          <span style={{ fontSize: 11, color: color.text.muted }}>
            Nothing saved yet — the file appears with your first note.
          </span>
        )}
      </div>
    </RowShell>
  )
}
