import QuickLauncher from '../launcher/QuickLauncher'
import { useAppLauncher } from '../../hooks/useAppLauncher'
import { color, sectionLabel } from '../../tokens'

/** Design state 03 — quick launcher above, clipboard history below. */
export default function LauncherModule({ active }: { active: boolean }) {
  const launcher = useAppLauncher(active)
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
          <div style={{ ...sectionLabel, margin: '14px 2px 4px', flex: 'none' }}>
            Clipboard history
          </div>
          <div
            style={{
              flex: 1,
              minHeight: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <span
              style={{
                fontSize: 11,
                color: color.text.muted,
                textAlign: 'center',
                lineHeight: 1.5,
                padding: '0 8px',
              }}
            >
              Not capturing yet — waiting on a decision
              <br />
              about how to handle passwords.
            </span>
          </div>
        </>
      )}
    </div>
  )
}
