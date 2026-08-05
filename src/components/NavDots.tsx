import { color } from '../tokens'
import { MODULES, type NotchModule } from '../types/notch'

const LABELS: Record<NotchModule, string> = {
  media: 'Media controls',
  launcher: 'Quick launcher',
  files: 'File shelf and notes',
}

interface Props {
  active: NotchModule
  onSelect: (module: NotchModule) => void
}

/**
 * Bottom nav shared by every expanded module. Active dot is a 16×4 accent bar,
 * inactive dots are 4×4 at .2 white, 6px apart — per the design export.
 */
export default function NavDots({ active, onSelect }: Props) {
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
      {MODULES.map((module) => {
        const isActive = module === active
        return (
          <button
            key={module}
            type="button"
            aria-label={LABELS[module]}
            title={LABELS[module]}
            aria-current={isActive}
            onClick={() => onSelect(module)}
            style={{
              // The button box is exactly the dot so the 6px gap stays true to
              // the design; the hit area is expanded by an overflowing child.
              position: 'relative',
              width: isActive ? 16 : 4,
              height: 4,
              padding: 0,
              borderRadius: 99,
              background: isActive ? color.accent : color.dotIdle,
              transition: 'width 180ms ease, background 180ms ease',
            }}
          >
            <span
              aria-hidden
              style={{ position: 'absolute', left: -6, right: -6, top: -10, bottom: -10 }}
            />
          </button>
        )
      })}
    </div>
  )
}
