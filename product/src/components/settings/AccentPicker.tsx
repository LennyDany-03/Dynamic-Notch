import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import RowShell from './RowShell'
import { ACCENT_SWATCHES } from '../../hooks/useSettings'
import { color, radius, spring } from '../../tokens'

/**
 * The accent picker — eight swatches and a hex field.
 *
 * The swatches are not a shortcut for the field, they are the recommended answer:
 * the app was drawn against a mid-violet on near-black Mica, and the eight are
 * all at roughly that lightness and saturation so any of them keeps the contrast
 * the rest of the palette assumes. The field is there because someone matching a
 * wallpaper or a team colour has a specific value in mind and no list will
 * contain it.
 *
 * **The preview is the app itself.** There is no swatch-sized "before and after"
 * here on purpose — every accented surface in this window repaints the instant a
 * swatch is clicked, including this row's own icon and the selected ring, because
 * the write goes to Rust and comes back as a `settings-changed` broadcast that
 * every window listens to. A preview box would be a worse copy of something the
 * user is already looking at.
 */
export default function AccentPicker({
  value,
  onChange,
}: {
  value: string
  onChange: (hex: string) => void
}) {
  /**
   * The field is uncontrolled between edits.
   *
   * Typing a hex means passing through invalid intermediate states — `#7C3A` is
   * four keystrokes into a valid value — and a controlled input fed from the
   * stored preference would fight the user by snapping back on every one. So the
   * draft lives here and is only committed on blur or Enter.
   */
  const [draft, setDraft] = useState(value)

  // Adopt whatever actually landed: a swatch click, a value Rust normalised
  // (`7c3aed` → `#7C3AED`), or a change made while this window was closed.
  useEffect(() => setDraft(value), [value])

  const commit = () => {
    const next = draft.trim()
    // Compared without the hash, because the field shows the value stripped of
    // it: retyping the colour that is already set would otherwise read as a
    // change and cost a pointless write and broadcast.
    const bare = (hex: string) => hex.replace(/^#/, '').toUpperCase()

    if (!next || bare(next) === bare(value)) {
      setDraft(value)
      return
    }
    onChange(next)
  }

  return (
    <RowShell
      title="Accent colour"
      body="The colour every active thing in Crest is drawn in — the scrub bar, the switches, a connected device, the day you have selected. Applies to the notch, the tray menu and this window at once."
      icon={
        <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3a9 9 0 0 0 0 18c1.4 0 2.2-.9 2.2-2 0-1-.7-1.6-.7-2.4 0-.7.6-1.3 1.4-1.3H17a4.5 4.5 0 0 0 4.5-4.6C21.5 6.3 17.3 3 12 3z" />
          <circle cx="7.5" cy="11" r="1.2" fill="currentColor" stroke="none" />
          <circle cx="11" cy="7.5" r="1.2" fill="currentColor" stroke="none" />
          <circle cx="15.5" cy="8.5" r="1.2" fill="currentColor" stroke="none" />
        </svg>
      }
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        {ACCENT_SWATCHES.map((swatch) => {
          const active = swatch.hex.toUpperCase() === value.toUpperCase()
          return (
            <button
              key={swatch.hex}
              type="button"
              aria-label={swatch.name}
              aria-pressed={active}
              title={swatch.name}
              onClick={() => onChange(swatch.hex)}
              style={{
                position: 'relative',
                width: 26,
                height: 26,
                flex: 'none',
                padding: 0,
                borderRadius: '50%',
                background: swatch.hex,
                // A hairline so a swatch close to the surface colour still has an
                // edge. Inset rather than a border: an outset ring would make the
                // selected one a different size from the rest.
                boxShadow: 'inset 0 0 0 1px rgba(255,255,255,.14)',
              }}
            >
              {active && (
                // Shared `layoutId`, so picking a new colour slides the ring
                // across rather than blinking it out and in — which is what makes
                // the eight read as one control.
                <motion.span
                  layoutId="accent-ring"
                  transition={spring.peek}
                  style={{
                    position: 'absolute',
                    inset: -4,
                    borderRadius: '50%',
                    boxShadow: `0 0 0 2px ${color.text.primary}`,
                  }}
                />
              )}
            </button>
          )
        })}

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            height: 28,
            padding: '0 4px 0 10px',
            borderRadius: radius.small,
            background: color.inset,
            boxShadow: color.insetShadow,
          }}
        >
          <span style={{ fontSize: 12, color: color.text.muted, fontFamily: 'ui-monospace,monospace' }}>
            #
          </span>
          <input
            value={draft.replace(/^#/, '')}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={commit}
            onKeyDown={(event) => {
              if (event.key === 'Enter') event.currentTarget.blur()
              // Escape abandons the edit rather than committing a half-typed
              // value, matching every other text field on Windows.
              if (event.key === 'Escape') {
                setDraft(value)
                event.currentTarget.blur()
              }
            }}
            spellCheck={false}
            maxLength={6}
            aria-label="Custom accent colour, as a hex value"
            style={{
              width: 62,
              border: 'none',
              outline: 'none',
              background: 'transparent',
              fontFamily: 'ui-monospace,monospace',
              fontSize: 12,
              letterSpacing: '.04em',
              textTransform: 'uppercase',
              color: color.text.primary,
              caretColor: color.accent,
              userSelect: 'text',
              WebkitUserSelect: 'text',
            }}
          />
        </div>
      </div>
    </RowShell>
  )
}
