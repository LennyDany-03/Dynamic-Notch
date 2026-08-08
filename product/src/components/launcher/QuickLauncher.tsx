import { useState } from 'react'
import AppIcon from './AppIcon'
import type { AppEntry } from '../../hooks/useAppLauncher'
import { useAppLauncher } from '../../hooks/useAppLauncher'
import { color, radius } from '../../tokens'

/**
 * Quick Launcher — the pinned tiles, and the empty slots that add to them.
 *
 * The design export's search field is gone. What it did (find an app by name,
 * then pin or launch it from the result row) the picker behind an empty slot now
 * does better, and a text field is a poor thing to put in an overlay that has to
 * ask the OS for focus before it can receive a keystroke.
 *
 * The consequence is deliberate and worth stating: the notch launches pinned apps
 * and nothing else. It is a shelf of the four you live in, not a substitute for
 * the Start menu.
 */

/**
 * One pinned app.
 *
 * A wrapper div rather than a button containing a button: nested buttons are
 * invalid HTML and WebView2 resolves them by dropping the outer one's click, so
 * the launch target and the unpin badge have to be siblings. (Same trap `Toggle`
 * documents from the other side.)
 */
function Tile({ app, onLaunch, onUnpin }: { app: AppEntry; onLaunch: () => void; onUnpin: () => void }) {
  const [hovered, setHovered] = useState(false)

  return (
    <div
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      style={{ position: 'relative', flex: 1, aspectRatio: '1', minWidth: 0 }}
    >
      <button
        type="button"
        className="tile"
        title={app.name}
        onClick={onLaunch}
        // Right-click still unpins. It predates the badge and costs nothing to
        // keep, and it is the only route on a tile the cursor cannot hover —
        // which is to say, none today, but it is one line.
        onContextMenu={(event) => {
          event.preventDefault()
          onUnpin()
        }}
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 0,
          borderRadius: radius.tile,
        }}
      >
        <AppIcon app={app} px={32} />
      </button>

      {/* Revealed on hover rather than always drawn: four tiles each wearing a
          permanent × reads as a row of errors, and the badge is only ever wanted
          for the tile the cursor is already on. */}
      {hovered && (
        <button
          type="button"
          aria-label={`Remove ${app.name}`}
          title={`Remove ${app.name}`}
          onClick={onUnpin}
          style={{
            position: 'absolute',
            top: -5,
            right: -5,
            width: 18,
            height: 18,
            display: 'grid',
            placeItems: 'center',
            borderRadius: radius.pill,
            // Opaque so the glyph stays legible over whatever icon is beneath it.
            background: 'rgba(20,20,20,.95)',
            boxShadow: '0 1px 4px rgba(0,0,0,.5)',
            color: color.text.strong,
          }}
        >
          <svg
            viewBox="0 0 24 24"
            width={10}
            height={10}
            fill="none"
            stroke="currentColor"
            strokeWidth={2.4}
            strokeLinecap="round"
          >
            <path d="M6 6l12 12" />
            <path d="M18 6L6 18" />
          </svg>
        </button>
      )}
    </div>
  )
}

export default function QuickLauncher({
  launcher,
  onAddPin,
}: {
  launcher: ReturnType<typeof useAppLauncher>
  /** Empty-slot click. The picker it opens is owned by `LauncherModule`, which
   *  is the component whose box the sheet has to cover. */
  onAddPin: () => void
}) {
  const { pinned, launch, togglePin, maxPinned } = launcher
  const emptySlots = Math.max(0, maxPinned - pinned.length)

  return (
    <div style={{ display: 'flex', gap: 10, flex: 'none' }}>
      {pinned.map((app) => (
        <Tile
          key={app.path}
          app={app}
          onLaunch={() => launch(app)}
          onUnpin={() => togglePin(app)}
        />
      ))}

      {Array.from({ length: emptySlots }).map((_, i) => (
        <button
          key={`slot-${i}`}
          type="button"
          aria-label="Pin an app"
          title="Pick an app to pin"
          onClick={onAddPin}
          style={{
            flex: 1,
            aspectRatio: '1',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: radius.tile,
            border: `1px dashed ${color.dashedStrong}`,
            padding: 0,
            minWidth: 0,
          }}
        >
          <svg
            viewBox="0 0 24 24"
            width={18}
            height={18}
            fill="none"
            stroke={color.text.muted}
            strokeWidth={1.5}
            strokeLinecap="round"
          >
            <path d="M12 6v12M6 12h12" />
          </svg>
        </button>
      ))}
    </div>
  )
}
