import { useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import QuickLauncher from '../launcher/QuickLauncher'
import AppPicker from '../launcher/AppPicker'
import ClipboardHistory from '../clipboard/ClipboardHistory'
import { useAppLauncher } from '../../hooks/useAppLauncher'
import { useClipboardHistory } from '../../hooks/useClipboardHistory'
import { color, sectionLabel } from '../../tokens'

/** Design state 03 — quick launcher above, clipboard history below. */
export default function LauncherModule({ active }: { active: boolean }) {
  const launcher = useAppLauncher(active)
  const clipboard = useClipboardHistory(active)

  // Owned here rather than in `QuickLauncher`, which raises it: the picker covers
  // the whole card, and this is the component whose box that is.
  const [picking, setPicking] = useState(false)

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        position: 'relative',
      }}
    >
      <QuickLauncher launcher={launcher} onAddPin={() => setPicking(true)} />

      {/* Always drawn now. It used to be hidden while the search field had a
          query, to give the results the full card; there is no search field. */}
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

      <AnimatePresence>
        {picking && (
          <AppPicker
            apps={launcher.apps}
            pinnedPaths={launcher.pinnedPaths}
            loaded={launcher.loaded}
            onPick={(app) => {
              launcher.togglePin(app)
              // Closes on the pick. The tile appearing in the row behind is the
              // confirmation, and it is not visible with the sheet still up.
              setPicking(false)
            }}
            onUnpin={launcher.togglePin}
            onClose={() => setPicking(false)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
