import type { ReactNode } from 'react'
import { color, radius } from '../../tokens'

/**
 * The anatomy every preference row in this window shares: an icon, a title, the
 * sentence underneath, and a control.
 *
 * Extracted when the third row appeared that could not be a `SettingRow` — the
 * accent picker, the weather location and the notes path are each a different
 * control under the same heading, and copying the wrapper three more times would
 * make the padding and the icon colour four separate decisions.
 *
 * A `div` and not a `button`, like `RangeRow` and unlike `SettingRow`: none of
 * these has a single whole-row gesture, and wrapping a swatch grid or a text
 * field in one makes every stray click do something.
 */
export default function RowShell({
  title,
  body,
  icon,
  children,
}: {
  title: string
  body: string
  icon: ReactNode
  /** The control. Sits under the copy, full width — see `RangeRow`. */
  children: ReactNode
}) {
  return (
    <div
      style={{
        padding: 12,
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
        borderRadius: radius.tile,
      }}
    >
      <span style={{ color: color.accent, display: 'flex', marginTop: 1, flex: 'none' }}>
        {icon}
      </span>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: color.text.primary }}>{title}</div>
        <div style={{ marginTop: 3, fontSize: 12, lineHeight: 1.5, color: color.text.muted }}>
          {body}
        </div>
        <div style={{ marginTop: 12 }}>{children}</div>
      </div>
    </div>
  )
}
