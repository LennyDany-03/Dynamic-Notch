import { useEffect, useState, type ReactNode } from 'react'
import { motion } from 'framer-motion'
import { invoke } from '@tauri-apps/api/core'
import { getVersion } from '@tauri-apps/api/app'
import { openUrl } from '@tauri-apps/plugin-opener'
import Toggle from '../Toggle'
import { useSettings } from '../../hooks/useSettings'
import { color, font, radius, sectionLabel, spring } from '../../tokens'

/**
 * The settings window — About and preferences, in its own borderless Mica window.
 *
 * Deliberately a separate window rather than a fourth notch module: the notch
 * collapses when the cursor leaves it, which is exactly wrong for a surface you
 * read. It is also the only window here with no hard height budget, so the card
 * fills the frame and the body scrolls rather than the copy being cut to fit.
 *
 * Like the tray popup it is hidden and reshown, never rebuilt (see `settings.rs`),
 * so nothing here may assume a mount coincides with an open.
 */

/** Transparent gutter left for the card's own shadow; window is card + 2×MARGIN. */
const MARGIN = 12

/** Mirrors `repo` in the site's `lib/site.ts` — same project, same links. */
const REPO = 'https://github.com/LennyDany-03/Dynamic-Notch'
const RELEASES = `${REPO}/releases`

const stroke = {
  fill: 'none',
  strokeWidth: 1.5,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

function Icon({ children, size = 18 }: { children: ReactNode; size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      {...stroke}
      stroke="currentColor"
      style={{ flex: 'none' }}
    >
      {children}
    </svg>
  )
}

/** What the notch actually does, one entry per module in nav order. */
const FEATURES: { id: string; title: string; body: string; icon: ReactNode }[] = [
  {
    id: 'media',
    title: 'Music player',
    body: 'Whatever Windows is playing — artwork, transport, scrub bar.',
    icon: (
      <Icon>
        <path d="M9 18V6l10-2v12" />
        <circle cx="6.5" cy="18" r="2.5" />
        <circle cx="16.5" cy="16" r="2.5" />
      </Icon>
    ),
  },
  {
    id: 'launcher',
    title: 'Quick launcher',
    body: 'Search installed apps, pin the ones you live in, replay your clipboard.',
    icon: (
      <Icon>
        <rect x="3" y="3" width="7" height="7" rx="2" />
        <rect x="14" y="3" width="7" height="7" rx="2" />
        <rect x="3" y="14" width="7" height="7" rx="2" />
        <rect x="14" y="14" width="7" height="7" rx="2" />
      </Icon>
    ),
  },
  {
    id: 'files',
    title: 'File shelf and notes',
    body: 'Park files by dragging them up, pull them back out anywhere. Notes alongside.',
    icon: (
      <Icon>
        <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      </Icon>
    ),
  },
]

function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section style={{ marginTop: 20 }}>
      <h2 style={{ ...sectionLabel, margin: '0 0 10px' }}>{label}</h2>
      {children}
    </section>
  )
}

/** Body copy — one shared type ramp so the About prose reads as a single block. */
function Paragraph({ children }: { children: ReactNode }) {
  return (
    <p
      style={{
        margin: '0 0 10px',
        fontSize: 12.5,
        lineHeight: 1.55,
        color: color.text.secondary,
      }}
    >
      {children}
    </p>
  )
}

/** A link out to the browser. Rendered as a chip so it cannot be mistaken for a row. */
function LinkChip({ href, children }: { href: string; children: ReactNode }) {
  const [hovered, setHovered] = useState(false)

  return (
    <button
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => void openUrl(href)}
      style={{
        height: 28,
        padding: '0 10px',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        borderRadius: radius.small,
        fontSize: 12,
        color: hovered ? color.text.strong : color.text.secondary,
        background: hovered ? color.tile : 'transparent',
        transition: 'background 90ms linear, color 90ms linear',
      }}
    >
      {children}
      <Icon size={13}>
        <path d="M14 4h6v6" />
        <path d="M20 4l-8 8" />
        <path d="M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4" />
      </Icon>
    </button>
  )
}

/**
 * A preference row: label, the sentence that says what turning it off costs, and
 * the switch. The whole row is the hit target — the switch itself is a 36px strip
 * and a poor one.
 */
function SettingRow({
  title,
  body,
  on,
  onToggle,
  icon,
}: {
  title: string
  body: string
  on: boolean
  onToggle: () => void
  icon: ReactNode
}) {
  const [hovered, setHovered] = useState(false)

  return (
    <button
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onToggle}
      role="switch"
      aria-checked={on}
      style={{
        width: '100%',
        padding: 12,
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
        borderRadius: radius.tile,
        textAlign: 'left',
        background: hovered ? color.tile : 'transparent',
        transition: 'background 90ms linear',
      }}
    >
      <span style={{ color: on ? color.accent : color.text.icon, display: 'flex', marginTop: 1 }}>
        {icon}
      </span>

      <span style={{ flex: 1, minWidth: 0 }}>
        <span
          style={{
            display: 'block',
            fontSize: 13,
            fontWeight: 500,
            color: color.text.primary,
          }}
        >
          {title}
        </span>
        <span
          style={{
            display: 'block',
            marginTop: 3,
            fontSize: 12,
            lineHeight: 1.5,
            color: color.text.muted,
          }}
        >
          {body}
        </span>
      </span>

      <span style={{ marginTop: 2 }}>
        <Toggle on={on} size="md" />
      </span>
    </button>
  )
}

export default function SettingsWindow() {
  const { settings, error, setAlwaysOnTop } = useSettings()
  const [version, setVersion] = useState('')
  const [closeHovered, setCloseHovered] = useState(false)

  useEffect(() => {
    getVersion().then(setVersion).catch(() => setVersion(''))
  }, [])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') void invoke('settings_close')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div
      onContextMenu={(event) => event.preventDefault()}
      style={{ position: 'fixed', inset: 0, padding: MARGIN, fontFamily: font.sans }}
    >
      <motion.div
        className="mica"
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={spring.expand}
        style={{ width: '100%', height: '100%', borderRadius: radius.shell }}
      >
        {/* Scrim over the Mica base, and the only surface in the app that gets one.
            Every other card is a few short rows; this one is a wall of body copy,
            and at .80 alpha the window behind it reads straight through the
            paragraphs. Local to this window on purpose — `.mica` itself is a
            transcription of the design file and stays as it is. */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(24,24,24,.45)',
            pointerEvents: 'none',
          }}
        />

        {/* Above .mica::before (noise) and .mica::after (hairline). */}
        <div
          style={{
            position: 'relative',
            zIndex: 1,
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* The window is borderless, so this strip is the whole title bar: it is
              the drag handle and it carries the only way to close. */}
          <header
            data-tauri-drag-region
            style={{
              height: 52,
              flex: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '0 12px 0 20px',
              borderBottom: `1px solid ${color.divider}`,
            }}
          >
            <div
              data-tauri-drag-region
              style={{
                width: 22,
                height: 22,
                borderRadius: radius.small,
                flex: 'none',
                display: 'grid',
                placeItems: 'center',
                background: color.accent,
                color: '#fff',
                fontSize: 13,
                fontWeight: 700,
                lineHeight: 1,
              }}
            >
              C
            </div>
            <span
              data-tauri-drag-region
              style={{ fontSize: 13, fontWeight: 600, color: color.text.primary }}
            >
              Settings
            </span>

            <span data-tauri-drag-region style={{ flex: 1 }} />

            <button
              onMouseEnter={() => setCloseHovered(true)}
              onMouseLeave={() => setCloseHovered(false)}
              onClick={() => void invoke('settings_close')}
              aria-label="Close settings"
              style={{
                width: 30,
                height: 30,
                flex: 'none',
                display: 'grid',
                placeItems: 'center',
                borderRadius: radius.small,
                color: closeHovered ? color.text.primary : color.text.icon,
                background: closeHovered ? 'rgba(248,113,113,.14)' : 'transparent',
                transition: 'background 90ms linear, color 90ms linear',
              }}
            >
              <Icon size={15}>
                <path d="M6 6l12 12" />
                <path d="M18 6L6 18" />
              </Icon>
            </button>
          </header>

          {/* Scrollbars are hidden app-wide, so the body is sized to fit its copy
              at the default type ramp; scrolling is the fallback, not the plan. */}
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '0 20px 20px' }}>
            <Section label="About this app">
              <Paragraph>
                <strong style={{ color: color.text.strong, fontWeight: 600 }}>Crest</strong> is a
                dynamic notch for Windows 11. It rests against the top edge of your screen, hidden
                until you reach for it, and gets out of the way the moment your cursor leaves.
              </Paragraph>
              <Paragraph>
                The small things you break your flow for — skipping a track, opening an app,
                finding something you copied ten minutes ago — normally each cost you a window to
                summon and dismiss. Crest gives them one surface that is always a flick of the
                mouse away and takes up none of your screen while you work.
              </Paragraph>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 12 }}>
                {FEATURES.map((feature) => (
                  <div
                    key={feature.id}
                    className="tile"
                    style={{ display: 'flex', alignItems: 'flex-start', gap: 11, padding: 11 }}
                  >
                    <span
                      style={{ color: color.text.icon, display: 'flex', marginTop: 1, flex: 'none' }}
                    >
                      {feature.icon}
                    </span>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 500, color: color.text.strong }}>
                        {feature.title}
                      </div>
                      <div
                        style={{
                          marginTop: 2,
                          fontSize: 11.5,
                          lineHeight: 1.45,
                          color: color.text.muted,
                        }}
                      >
                        {feature.body}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div
                style={{
                  marginTop: 14,
                  paddingTop: 12,
                  borderTop: `1px solid ${color.divider}`,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <span style={{ fontSize: 12, color: color.text.secondary }}>Version</span>
                <span
                  style={{
                    marginLeft: 6,
                    padding: '2px 8px',
                    borderRadius: radius.pill,
                    background: color.tile,
                    fontFamily: font.mono,
                    fontSize: 11.5,
                    color: color.text.strong,
                  }}
                >
                  {version || '—'}
                </span>

                <span style={{ flex: 1 }} />

                <LinkChip href={RELEASES}>Release notes</LinkChip>
                <LinkChip href={REPO}>GitHub</LinkChip>
              </div>
            </Section>

            <Section label="Settings">
              <SettingRow
                title="Always on top"
                body="Keeps the notch on screen and above other windows, so it is there without reaching for it. Off means it stays hidden until your cursor finds it, and sits behind whatever app is in front."
                on={settings.alwaysOnTop}
                onToggle={() => setAlwaysOnTop(!settings.alwaysOnTop)}
                icon={
                  <Icon>
                    <path d="M12 3l7 4v10l-7 4-7-4V7z" />
                    <path d="M5 7l7 4 7-4" />
                    <path d="M12 11v10" />
                  </Icon>
                }
              />

              {error && (
                <p
                  style={{
                    margin: '8px 12px 0',
                    fontSize: 11.5,
                    color: color.fileRed,
                  }}
                >
                  {error}
                </p>
              )}
            </Section>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
