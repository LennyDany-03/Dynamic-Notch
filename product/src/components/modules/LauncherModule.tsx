import QuickLauncher from '../launcher/QuickLauncher'
import ClipboardHistory from '../clipboard/ClipboardHistory'
import { useAppLauncher } from '../../hooks/useAppLauncher'
import { useClipboardHistory } from '../../hooks/useClipboardHistory'
import { color, sectionLabel } from '../../tokens'

/** Design state 03 — quick launcher above, clipboard history below. */
export default function LauncherModule({ active }: { active: boolean }) {
  const launcher = useAppLauncher(active)
  const clipboard = useClipboardHistory(active)
  const searching = launcher.query.trim().length > 0

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
      }}
    >
      <QuickLauncher launcher={launcher} />

      {/* Hidden while searching so results get the full card. */}
      {!searching && (
        <>
          <div
            style={{
              ...sectionLabel,
              margin: '14px 2px 4px',
              flex: 'none',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span>Clipboard history</span>
            {clipboard.entries.length > 0 && (
              <button
                type="button"
                onClick={clipboard.clear}
                title="Clear clipboard history"
                style={{ ...sectionLabel, padding: 0, color: color.text.muted }}
              >
                Clear
              </button>
            )}
          </div>
          <ClipboardHistory
            entries={clipboard.entries}
            loaded={clipboard.loaded}
            onCopy={clipboard.copy}
          />
        </>
      )}
    </div>
  )
}
