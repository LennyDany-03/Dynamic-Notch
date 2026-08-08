import { color, sectionLabel, size } from '../tokens'
import type { NotchModule } from '../types/notch'

const LABELS: Record<NotchModule, string> = {
  media: 'Media controls',
  launcher: 'Quick launcher and clipboard',
  files: 'File shelf and notes',
  notifications: 'Notifications',
}

/**
 * Stand-in for an expanded module. Exists only to prove the state machine, the
 * spring resize and the Mica surface behave before any feature is layered on.
 * Each of these gets replaced by a real component in build order.
 */
export default function ModulePlaceholder({ module }: { module: NotchModule }) {
  const { width, height } = size[module]

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div style={sectionLabel}>{LABELS[module]}</div>
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 8,
          border: `1px dashed ${color.dashed}`,
          marginTop: 10,
        }}
      >
        <span style={{ fontSize: 12, color: color.text.muted }}>
          Placeholder · {width} × {height}
        </span>
      </div>
    </div>
  )
}
