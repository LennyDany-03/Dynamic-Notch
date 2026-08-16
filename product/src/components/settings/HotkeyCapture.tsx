import { useEffect, useState } from 'react'
import { formatHotkey } from '../../hooks/useSettings'
import { color, font, radius } from '../../tokens'

/**
 * The shortcut field: click it, press the combination, done.
 *
 * A recorder rather than a text box, because the value is an accelerator string
 * and nobody should have to know that. It is also the only control in this window
 * whose input is *the thing itself* — you cannot type "Ctrl+Shift+N" any faster
 * than you can press it, and pressing it is the one way to find out that your
 * screen recorder already owns it.
 *
 * Three rules while recording, and each answers a way this goes wrong:
 *
 *  - **Modifier presses alone are ignored.** Ctrl arrives as its own keydown a
 *    moment before the letter does, so a recorder that took the first key it saw
 *    would capture "Ctrl" and stop listening before the user had finished the
 *    gesture.
 *  - **A shortcut needs a modifier.** A bare `N` is registered system-wide, which
 *    means no text field anywhere on Windows sees the letter again — and the user
 *    who did it cannot type the `n` needed to fix it. Refused here, and refused
 *    again in `hotkey.rs`, because `settings.json` is hand-editable.
 *  - **Escape cancels and Backspace clears**, which are the two things a recording
 *    field has to offer or there is no way out of it except binding something.
 *
 * The key is stored as a `KeyboardEvent.code` (`KeyN`), not a `key` (`n`): `code`
 * names the physical key, so a shortcut set on QWERTY is the same key on AZERTY
 * rather than a different one — and it is unaffected by the modifiers themselves,
 * where `key` for Ctrl+Shift+2 is `"@"` on one layout and `"2"` on another.
 * `formatHotkey` is what turns it back into something readable.
 */

/** Codes that are only ever a modifier — never the key half of a shortcut. */
const MODIFIER_CODES = new Set([
  'ControlLeft',
  'ControlRight',
  'AltLeft',
  'AltRight',
  'ShiftLeft',
  'ShiftRight',
  'MetaLeft',
  'MetaRight',
])

function accelerator(event: KeyboardEvent): string | null {
  if (MODIFIER_CODES.has(event.code)) return null

  const parts: string[] = []
  if (event.ctrlKey) parts.push('Ctrl')
  if (event.altKey) parts.push('Alt')
  if (event.shiftKey) parts.push('Shift')
  // `Super` is the name the parser in `hotkey.rs` takes; `formatHotkey` shows it
  // back as "Win", which is what is printed on the key.
  if (event.metaKey) parts.push('Super')

  if (parts.length === 0) return null

  parts.push(event.code)
  return parts.join('+')
}

export default function HotkeyCapture({
  value,
  onChange,
}: {
  value: string | null
  onChange: (accelerator: string | null) => void
}) {
  const [recording, setRecording] = useState(false)
  const [hovered, setHovered] = useState(false)
  /** Set when the user pressed a key with no modifier — the one refusal worth explaining. */
  const [needsModifier, setNeedsModifier] = useState(false)

  useEffect(() => {
    if (!recording) return

    const onKey = (event: KeyboardEvent) => {
      // Capture phase, and propagation stopped: this window closes on Escape (see
      // `SettingsWindow`), and a recorder that let Escape through would shut the
      // settings window instead of cancelling the recording.
      event.preventDefault()
      event.stopPropagation()

      if (event.key === 'Escape') {
        setRecording(false)
        setNeedsModifier(false)
        return
      }

      if (event.key === 'Backspace' || event.key === 'Delete') {
        setRecording(false)
        setNeedsModifier(false)
        onChange(null)
        return
      }

      if (MODIFIER_CODES.has(event.code)) return

      const next = accelerator(event)
      if (!next) {
        setNeedsModifier(true)
        return
      }

      setRecording(false)
      setNeedsModifier(false)
      onChange(next)
    }

    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [recording, onChange])

  const label = recording ? 'Press a shortcut…' : value ? formatHotkey(value) : 'Not set'

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <button
        type="button"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onClick={() => {
          setNeedsModifier(false)
          setRecording((was) => !was)
        }}
        // Blurring while recording would leave the field looking armed with
        // nothing listening — the keydown handler is on `window`, so it only
        // works while this window has focus in the first place.
        onBlur={() => setRecording(false)}
        aria-label="Shortcut that summons the notch"
        style={{
          flex: 1,
          minWidth: 0,
          height: 34,
          padding: '0 12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: radius.tile,
          background: color.inset,
          boxShadow: recording ? `inset 0 0 0 1.5px ${color.accent}` : color.insetShadow,
          fontFamily: font.mono,
          fontSize: 12,
          letterSpacing: '.02em',
          color: recording
            ? color.accent
            : value
              ? color.text.primary
              : hovered
                ? color.text.secondary
                : color.text.muted,
          transition: 'box-shadow 90ms linear, color 90ms linear',
        }}
      >
        {label}
      </button>

      {/* Only while something is bound. A "Clear" next to "Not set" is a button
          that does nothing, sitting where the eye goes to find out what to do. */}
      {value && !recording && (
        <button
          type="button"
          onClick={() => onChange(null)}
          style={{
            height: 34,
            flex: 'none',
            padding: '0 12px',
            borderRadius: radius.tile,
            fontSize: 12,
            color: color.text.secondary,
            background: color.tile,
          }}
        >
          Clear
        </button>
      )}

      {recording && (
        <span
          style={{
            flex: 'none',
            fontSize: 11,
            color: needsModifier ? color.fileRed : color.text.muted,
            maxWidth: 150,
            lineHeight: 1.35,
          }}
        >
          {needsModifier ? 'Add Ctrl, Alt, Shift or Win.' : 'Esc cancels · Backspace clears'}
        </span>
      )}
    </div>
  )
}
