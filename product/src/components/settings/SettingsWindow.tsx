import { useEffect, useRef, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { invoke } from '@tauri-apps/api/core'
import { getVersion } from '@tauri-apps/api/app'
import { openUrl } from '@tauri-apps/plugin-opener'
import Toggle from '../Toggle'
import AccentPicker from './AccentPicker'
import NotesLocation from './NotesLocation'
import PanelOrder from './PanelOrder'
import Slider from './Slider'
import WeatherLocation from './WeatherLocation'
import { NOTCH_POSITIONS, OPACITY, useNotificationAccess, useSettings } from '../../hooks/useSettings'
import { useAccentColor } from '../../hooks/useAccentColor'
import { useSurfaceOpacity } from '../../hooks/useSurfaceOpacity'
import { color, font, radius, sectionLabel, spring } from '../../tokens'

/**
 * The settings window — About and preferences, in its own borderless Mica window.
 *
 * Deliberately a separate window rather than a fourth notch module: the notch
 * collapses when the cursor leaves it, which is exactly wrong for a surface you
 * read. It is also the only window here with no hard height budget, so the card
 * fills the frame and the body scrolls rather than the copy being cut to fit.
 *
 * Laid out as a nav pane plus a content pane, the shape Windows 11's own Settings
 * uses: the two halves answer different questions ("what is this?" and "how do I
 * want it to behave?") and stacking them made the switches the reward for
 * scrolling past the pitch. Panes are mounted one at a time and the body scrolls
 * per pane, so neither half's length can push the other's out of reach.
 *
 * Like the tray popup it is hidden and reshown, never rebuilt (see `settings.rs`),
 * so nothing here may assume a mount coincides with an open — including the
 * selected pane, which deliberately survives a close so reopening lands where the
 * user left off.
 */

/** Transparent gutter left for the card's own shadow; window is card + 2×MARGIN. */
const MARGIN = 12

/** Nav pane. Wide enough for the longest label at 12.5px without wrapping. */
const SIDEBAR = 200

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

/**
 * The sidebar's panes.
 *
 * Split out of a single "Settings" pane once it had grown past a screenful. Two
 * things earned their own entry rather than another group label inside it:
 *
 *  - **Appearance** is the pair of preferences that change how Crest *looks*
 *    rather than what it does, and they are the two people come back to. Buried
 *    under a heading at the top of a long scroller they were findable only by
 *    remembering they were there.
 *  - **Weather** is the one place Crest has to be *told* something before a
 *    feature works at all. Sitting three groups down among switches, it read as
 *    an option for a feature you already had, rather than as the setup step it is.
 *
 * Everything left is a switch about behaviour, and that is still "Settings".
 */
type Pane = 'about' | 'panels' | 'appearance' | 'weather' | 'notes' | 'settings'

/** Nav entries, in the order they appear in the sidebar. */
const PANES: { id: Pane; label: string; icon: ReactNode }[] = [
  {
    id: 'about',
    label: 'About this app',
    icon: (
      <Icon size={16}>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 11v5" />
        <path d="M12 8h.01" />
      </Icon>
    ),
  },
  {
    id: 'panels',
    label: 'Panels',
    icon: (
      <Icon size={16}>
        <rect x="3" y="4" width="18" height="6" rx="2" />
        <rect x="3" y="14" width="11" height="6" rx="2" />
        <path d="M17.5 17h3.5" />
      </Icon>
    ),
  },
  {
    id: 'appearance',
    label: 'Appearance',
    icon: (
      <Icon size={16}>
        <path d="M12 3a9 9 0 0 0 0 18c1.4 0 2.2-.9 2.2-2 0-1-.7-1.6-.7-2.4 0-.7.6-1.3 1.4-1.3H17a4.5 4.5 0 0 0 4.5-4.6C21.5 6.3 17.3 3 12 3z" />
        <circle cx="7.6" cy="11.4" r="1.1" fill="currentColor" stroke="none" />
        <circle cx="11" cy="7.8" r="1.1" fill="currentColor" stroke="none" />
        <circle cx="15.4" cy="8.8" r="1.1" fill="currentColor" stroke="none" />
      </Icon>
    ),
  },
  {
    id: 'weather',
    label: 'Weather',
    icon: (
      <Icon size={16}>
        <circle cx="8.5" cy="8.5" r="3" />
        <path d="M8.5 2.6v1.4M3.1 8.5h1.4M4.6 4.6l1 1M12.4 4.6l-1 1" />
        <path d="M8.4 19.6a3.6 3.6 0 0 1-.4-7.2 5 5 0 0 1 9.7.4 3.4 3.4 0 0 1-.3 6.8z" />
      </Icon>
    ),
  },
  {
    id: 'notes',
    label: 'Notes',
    icon: (
      <Icon size={16}>
        <path d="M5 4.5A1.5 1.5 0 0 1 6.5 3H15l4 4v13.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 20.5z" />
        <path d="M14.5 3v4.5H19" />
        <path d="M8.5 13h7M8.5 16.5h4.5" />
      </Icon>
    ),
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: (
      <Icon size={16}>
        <path d="M4 7h9" />
        <path d="M17 7h3" />
        <circle cx="15" cy="7" r="2" />
        <path d="M4 17h3" />
        <path d="M11 17h9" />
        <circle cx="9" cy="17" r="2" />
      </Icon>
    ),
  },
]

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
  {
    id: 'notifications',
    title: 'Notifications',
    body: 'What Windows has been telling you, announced as it arrives and kept until you read it.',
    icon: (
      <Icon>
        <path d="M18 8a6 6 0 1 0-12 0c0 5-2 6-2 6h16s-2-1-2-6" />
        <path d="M13.7 19a2 2 0 0 1-3.4 0" />
      </Icon>
    ),
  },
  {
    id: 'system',
    title: 'System monitor',
    body: 'CPU, memory, GPU and disk, with a word when one of them is pinned. Sleep, restart and shut down.',
    icon: (
      <Icon>
        <path d="M3 13h3.5l2-5 3 10 2.5-7 1.5 2H21" />
      </Icon>
    ),
  },
  {
    id: 'weather',
    title: 'Weather',
    body: 'Conditions where you are and the rest of the week. Pick a place in Settings.',
    icon: (
      <Icon>
        <circle cx="8.5" cy="8.5" r="3" />
        <path d="M8.5 2.6v1.4M3.1 8.5h1.4M4.6 4.6l1 1M12.4 4.6l-1 1" />
        <path d="M8.4 19.6a3.6 3.6 0 0 1-.4-7.2 5 5 0 0 1 9.7.4 3.4 3.4 0 0 1-.3 6.8z" />
      </Icon>
    ),
  },
  {
    id: 'calendar',
    title: 'Calendar and reminders',
    body: 'A month at a glance, and a nudge from the notch when six o’clock and the groceries come round.',
    icon: (
      <Icon>
        <rect x="3.5" y="5" width="17" height="16" rx="2.5" />
        <path d="M3.5 10h17M8 3.5v3M16 3.5v3" />
      </Icon>
    ),
  },
]

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

/** Sub-heading inside a pane. The pane's own name is in the header, not here. */
function GroupLabel({ children }: { children: ReactNode }) {
  return <h3 style={{ ...sectionLabel, margin: '18px 0 8px' }}>{children}</h3>
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
 * A sidebar entry. The accent bar is a single shared element (`layoutId`) rather
 * than one per row, so selecting a pane slides it between rows instead of
 * blinking it out and in — the movement is what says the two are one selection.
 */
function NavItem({
  pane,
  active,
  onSelect,
}: {
  pane: (typeof PANES)[number]
  active: boolean
  onSelect: (id: Pane) => void
}) {
  const [hovered, setHovered] = useState(false)

  return (
    <button
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => onSelect(pane.id)}
      aria-current={active ? 'page' : undefined}
      style={{
        position: 'relative',
        width: '100%',
        height: 36,
        padding: '0 10px 0 14px',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        borderRadius: radius.tile,
        textAlign: 'left',
        background: active ? color.tile : hovered ? 'rgba(255,255,255,.035)' : 'transparent',
        transition: 'background 90ms linear',
      }}
    >
      {active && (
        <motion.span
          layoutId="nav-indicator"
          transition={spring.peek}
          style={{
            position: 'absolute',
            left: 0,
            top: 9,
            width: 3,
            height: 18,
            borderRadius: radius.pill,
            background: color.accent,
          }}
        />
      )}

      <span
        style={{
          display: 'flex',
          color: active ? color.text.primary : color.text.icon,
          transition: 'color 90ms linear',
        }}
      >
        {pane.icon}
      </span>
      <span
        style={{
          fontSize: 12.5,
          fontWeight: active ? 600 : 500,
          color: active ? color.text.primary : color.text.secondary,
          transition: 'color 90ms linear',
        }}
      >
        {pane.label}
      </span>
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
  disabled = false,
}: {
  title: string
  body: string
  on: boolean
  onToggle: () => void
  icon: ReactNode
  /** For a preference that cannot be honoured yet — see the note under the row. */
  disabled?: boolean
}) {
  const [hovered, setHovered] = useState(false)

  return (
    <button
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => {
        if (!disabled) onToggle()
      }}
      role="switch"
      aria-checked={on}
      aria-disabled={disabled}
      style={{
        width: '100%',
        padding: 12,
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
        borderRadius: radius.tile,
        textAlign: 'left',
        background: hovered && !disabled ? color.tile : 'transparent',
        // Dimmed rather than hidden: the preference still exists, and a row that
        // vanished would leave the note underneath explaining nothing.
        opacity: disabled ? 0.45 : 1,
        cursor: disabled ? 'default' : 'pointer',
        transition: 'background 90ms linear, opacity 90ms linear',
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

/**
 * A preference with a range rather than two states. Same anatomy as `SettingRow`
 * — icon, title, the sentence underneath — with the control on its own line: a
 * slider squeezed into the trailing column beside four lines of body copy is a
 * 60px drag for a 40-point range.
 *
 * Not a button, unlike `SettingRow`: there is no whole-row gesture to offer, and
 * wrapping a slider in one would make every stray click on the label jump the
 * value.
 */
function RangeRow({
  title,
  body,
  display,
  icon,
  children,
}: {
  title: string
  body: string
  /** The current value, spelled for reading. The slider carries it for a11y. */
  display: string
  icon: ReactNode
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
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 500, color: color.text.primary }}>{title}</span>
          <span style={{ flex: 1 }} />
          <span
            style={{
              fontFamily: font.mono,
              fontSize: 11.5,
              color: color.text.secondary,
              // Tabular so the readout does not shuffle the row while dragging.
              fontVariantNumeric: 'tabular-nums',
            }}
            aria-hidden
          >
            {display}
          </span>
        </div>

        <div style={{ marginTop: 3, fontSize: 12, lineHeight: 1.5, color: color.text.muted }}>
          {body}
        </div>

        <div style={{ marginTop: 12, paddingRight: 2 }}>{children}</div>
      </div>
    </div>
  )
}

/**
 * A preference with a handful of named states. Same anatomy as `RangeRow` — the
 * control gets its own line, because three segments squeezed into the trailing
 * column would be three 40px targets.
 *
 * The selected segment is drawn by one shared element (`layoutId`), as in the
 * sidebar: picking a position slides the fill across rather than blinking it out
 * of one segment and into the next, which is what says the three are one choice.
 */
function ChoiceRow<T extends string>({
  title,
  body,
  icon,
  options,
  value,
  onSelect,
}: {
  title: string
  body: string
  icon: ReactNode
  options: { id: T; label: string }[]
  value: T
  onSelect: (id: T) => void
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

        <div
          role="radiogroup"
          aria-label={title}
          style={{
            marginTop: 12,
            padding: 3,
            display: 'flex',
            gap: 3,
            borderRadius: radius.tile,
            background: color.inset,
            boxShadow: color.insetShadow,
          }}
        >
          {options.map((option) => {
            const active = option.id === value
            return (
              <button
                key={option.id}
                role="radio"
                aria-checked={active}
                onClick={() => onSelect(option.id)}
                style={{
                  position: 'relative',
                  flex: 1,
                  height: 28,
                  borderRadius: radius.small,
                  fontSize: 12,
                  fontWeight: active ? 600 : 500,
                  color: active ? color.text.primary : color.text.secondary,
                  transition: 'color 90ms linear',
                }}
              >
                {active && (
                  <motion.span
                    layoutId="position-segment"
                    transition={spring.peek}
                    style={{
                      position: 'absolute',
                      inset: 0,
                      borderRadius: radius.small,
                      background: color.accent,
                    }}
                  />
                )}
                <span style={{ position: 'relative' }}>{option.label}</span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function AboutPane({ version }: { version: string }) {
  return (
    <>
      <Paragraph>
        <strong style={{ color: color.text.strong, fontWeight: 600 }}>Crest</strong> is a dynamic
        notch for Windows 11. It rests against the top edge of your screen, hidden until you reach
        for it, and gets out of the way the moment your cursor leaves.
      </Paragraph>
      <Paragraph>
        The small things you break your flow for — skipping a track, opening an app, finding
        something you copied ten minutes ago — normally each cost you a window to summon and
        dismiss. Crest gives them one surface that is always a flick of the mouse away and takes up
        none of your screen while you work.
      </Paragraph>

      <GroupLabel>What it does</GroupLabel>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {FEATURES.map((feature) => (
          <div
            key={feature.id}
            className="tile"
            style={{ display: 'flex', alignItems: 'flex-start', gap: 11, padding: 11 }}
          >
            <span style={{ color: color.text.icon, display: 'flex', marginTop: 1, flex: 'none' }}>
              {feature.icon}
            </span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: 500, color: color.text.strong }}>
                {feature.title}
              </div>
              <div
                style={{ marginTop: 2, fontSize: 11.5, lineHeight: 1.45, color: color.text.muted }}
              >
                {feature.body}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div
        style={{
          marginTop: 16,
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
    </>
  )
}

/**
 * Which cards the notch offers, and in what order.
 *
 * Its own pane because it is not a preference among preferences — it decides what
 * the app *is* for this user. Seven cards is also past the point where a ring is
 * comfortable to walk, so most people will want fewer, and the place to say so
 * should not be three groups down a list of switches.
 */
function PanelsPane({ api }: { api: ReturnType<typeof useSettings> }) {
  const { settings, error, setPanels } = api

  return (
    <>
      <h3 style={{ ...sectionLabel, margin: '0 0 8px' }}>Panels</h3>

      <Paragraph>
        The notch cycles these with the arrows at the top of each card. Switch off
        the ones you don’t use and drag the rest into the order you want them —
        the tray menu follows the same list.
      </Paragraph>

      <div style={{ height: 6 }} />

      <PanelOrder stored={settings.panels} onChange={setPanels} />

      {error && (
        <p style={{ margin: '8px 12px 0', fontSize: 11.5, color: color.fileRed }}>{error}</p>
      )}
    </>
  )
}

/**
 * How Crest looks: the two preferences that change nothing about what it does.
 *
 * Its own pane rather than a group at the top of the settings scroller, because
 * these are the two people come back to and adjust — and both repaint every
 * window live, so the pane you are looking at *is* the preview.
 */
function AppearancePane({
  api,
  opacity,
  onPreviewOpacity,
}: {
  api: ReturnType<typeof useSettings>
  /** Stored value, or the position of a drag in progress. */
  opacity: number
  onPreviewOpacity: (percent: number | null) => void
}) {
  const { settings, error, setBackgroundOpacity, setAccentColor } = api

  return (
    <>
      <h3 style={{ ...sectionLabel, margin: '0 0 8px' }}>Surface</h3>

      <RangeRow
        title="Background opacity"
        body="How solid the notch, the tray menu and this window are drawn. Lower lets more of your wallpaper through; higher keeps text readable over a busy desktop."
        display={`${opacity}%`}
        icon={
          <Icon>
            <circle cx="12" cy="12" r="9" />
            <path d="M12 3v18" />
            <path d="M12 3a9 9 0 0 1 0 18" fill="currentColor" stroke="none" />
          </Icon>
        }
      >
        <Slider
          label="Background opacity"
          value={opacity}
          min={OPACITY.min}
          max={OPACITY.max}
          step={OPACITY.step}
          onPreview={onPreviewOpacity}
          onCommit={(percent) => {
            // Drop the preview in the same tick as the write. The stored value is
            // what the window paints from once this lands, and holding a preview
            // over it would ignore a clamp Rust applied on the way through.
            onPreviewOpacity(null)
            setBackgroundOpacity(percent)
          }}
        />
      </RangeRow>

      <GroupLabel>Colour</GroupLabel>

      <AccentPicker value={settings.accentColor} onChange={setAccentColor} />

      {error && (
        <p style={{ margin: '8px 12px 0', fontSize: 11.5, color: color.fileRed }}>{error}</p>
      )}
    </>
  )
}

/**
 * Where the weather module looks.
 *
 * A pane of its own for one control, which looks like too much until you notice
 * it is not a preference: it is the one thing Crest has to be *told* before a
 * feature works at all. Sitting three groups down a list of switches, it read as
 * an option for something you already had.
 */
/**
 * Notes: where they live, and a way to read them.
 *
 * Its own pane for the same reason Weather has one — it is not a switch. It is
 * the answer to "where did what I typed go", and that question deserves better
 * than being the last group at the bottom of a list of toggles.
 */
function NotesPane() {
  return (
    <>
      <h3 style={{ ...sectionLabel, margin: '0 0 8px' }}>Notes</h3>

      <Paragraph>
        Quick Notes live on the file shelf card in the notch and save themselves as
        you type. Everything you have written is here too, in one place, as text.
      </Paragraph>

      <div style={{ height: 6 }} />

      <NotesLocation />
    </>
  )
}

function WeatherPane({ api }: { api: ReturnType<typeof useSettings> }) {
  const { settings, error, setWeatherPlace } = api

  return (
    <>
      <h3 style={{ ...sectionLabel, margin: '0 0 8px' }}>Weather</h3>

      <WeatherLocation place={settings.weatherPlace} onChange={setWeatherPlace} />

      {error && (
        <p style={{ margin: '8px 12px 0', fontSize: 11.5, color: color.fileRed }}>{error}</p>
      )}
    </>
  )
}

function SettingsPane({ api }: { api: ReturnType<typeof useSettings> }) {
  const {
    settings,
    error,
    setAlwaysOnTop,
    setNotifications,
    setSystemAlerts,
    setMuteWindowsBanners,
    setNotchPosition,
    setHotzoneHint,
  } = api
  const notificationAccess = useNotificationAccess()

  return (
    <>
      <h3 style={{ ...sectionLabel, margin: '0 0 8px' }}>General</h3>

      <ChoiceRow
        title="Position"
        body="Which end of the top edge the notch lives on. Everything moves with it — the strip you hover to summon it included."
        options={NOTCH_POSITIONS}
        value={settings.notchPosition}
        onSelect={setNotchPosition}
        icon={
          <Icon>
            <rect x="3" y="5" width="18" height="13" rx="2" />
            <path d="M9 5h6v2a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1z" fill="currentColor" stroke="none" />
          </Icon>
        }
      />

      <SettingRow
        title="Show me where it is"
        body="Marks the top edge with a thin line at the spot that summons the notch, so you know where to send your cursor. It disappears the moment the notch comes down."
        on={settings.hotzoneHint}
        onToggle={() => setHotzoneHint(!settings.hotzoneHint)}
        // Nothing this switch does is visible while the pill is resting on
        // screen: the mark is drawn at the top centre and the pill sits on that
        // exact spot. Dimming it and saying so is the honest version — it used to
        // be left on, draw for one commit at startup and vanish, which looks like
        // a broken switch rather than one that does not apply.
        disabled={settings.alwaysOnTop}
        icon={
          <Icon>
            <path d="M8 4h8" />
            <path d="M12 8v6" />
            <path d="M9 11l3 3 3-3" />
            <path d="M6 19h12" />
          </Icon>
        }
      />

      {settings.alwaysOnTop && (
        <p
          style={{
            margin: '2px 12px 0',
            paddingLeft: 30,
            fontSize: 11.5,
            lineHeight: 1.5,
            color: color.text.muted,
          }}
        >
          Not needed right now — <strong style={{ color: color.text.secondary, fontWeight: 500 }}>Always on top</strong> is
          keeping the notch on screen, so the pill is already sitting on the spot this
          would mark. Turn that off and the line comes back.
        </p>
      )}

      <SettingRow
        title="Always on top"
        body="Keeps the notch on screen and above other windows, so it is there without reaching for it. Off means it stays hidden until your cursor finds it — it still comes up in front of whatever you are working in, then drops back behind once it closes."
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

      <GroupLabel>Notifications</GroupLabel>

      <SettingRow
        title="Notifications in the notch"
        body="Anything Windows notifies you about drops down from the notch for a few seconds, then gets out of the way. Hovering it holds it there while you read."
        on={settings.notifications}
        onToggle={() => setNotifications(!settings.notifications)}
        disabled={notificationAccess === false}
        icon={
          <Icon>
            <path d="M18 8a6 6 0 1 0-12 0c0 5-2 6-2 6h16s-2-1-2-6" />
            <path d="M13.7 19a2 2 0 0 1-3.4 0" />
          </Icon>
        }
      />

      <SettingRow
        title="Mute Windows' own banners"
        body="Stops Windows drawing its pop-up in the bottom-right corner, so a notification appears in the notch and nowhere else. It still lands in the notification centre, and Windows gets its banners back if you turn this off or quit Crest."
        on={settings.muteWindowsBanners}
        onToggle={() => setMuteWindowsBanners(!settings.muteWindowsBanners)}
        disabled={notificationAccess === false || !settings.notifications}
        icon={
          <Icon>
            <path d="M18 8a6 6 0 0 0-9.3-5" />
            <path d="M6 9v-1a6 6 0 0 1 .4-2.1" />
            <path d="M6 8c0 5-2 6-2 6h13" />
            <path d="M13.7 19a2 2 0 0 1-3.4 0" />
            <path d="M4 3l16 18" />
          </Icon>
        }
      />

      {/* The one thing neither switch can fix from in here. Without this access
          the notch has nothing to announce, so both rows are inert and Rust
          refuses to silence Windows on top of that. */}
      {notificationAccess === false && (
        <p style={{ margin: '2px 12px 0', fontSize: 11.5, lineHeight: 1.5, color: color.text.muted }}>
          Windows hasn't given Crest access to your notifications. Turn on{' '}
          <strong style={{ color: color.text.secondary, fontWeight: 500 }}>
            Settings → Privacy &amp; security → Notifications
          </strong>
          , then reopen this window.
        </p>
      )}

      {/* Its own group rather than a third row under Notifications: these arrive
          on the same banner, but nothing here comes from Windows' notification
          centre, and the note above belongs to the two rows it sits under. */}
      <GroupLabel>Your machine</GroupLabel>

      <SettingRow
        title="Charger, Wi-Fi and system load"
        body="Tells you the moment a charger goes in or comes out, a Bluetooth device connects or drops, or your network changes — and speaks up when your CPU, memory, GPU or disk has been pinned long enough to mean it. A few seconds in the notch, then gone. The system monitor keeps its meters either way."
        on={settings.systemAlerts}
        onToggle={() => setSystemAlerts(!settings.systemAlerts)}
        icon={
          <Icon>
            <rect x="2" y="8" width="15" height="8" rx="2" />
            <path d="M20 11v2" />
            <path d="M11.6 9.4L8.9 13h2.2l-.5 2.5 2.9-3.5h-2.3z" fill="currentColor" stroke="none" />
          </Icon>
        }
      />

      {error && (
        <p style={{ margin: '8px 12px 0', fontSize: 11.5, color: color.fileRed }}>{error}</p>
      )}
    </>
  )
}

export default function SettingsWindow() {
  const [pane, setPane] = useState<Pane>('about')
  const [version, setVersion] = useState('')
  const [closeHovered, setCloseHovered] = useState(false)
  const body = useRef<HTMLDivElement>(null)

  // Held here rather than in the Settings pane: the opacity applies to this whole
  // window, and the pane it is edited from unmounts when the user switches to
  // About. `preview` is the position of a drag in progress, which is what makes
  // the surface follow the knob instead of jumping on release.
  const api = useSettings()
  const [preview, setPreview] = useState<number | null>(null)
  const opacity = preview ?? api.settings.backgroundOpacity
  useSurfaceOpacity(opacity)
  // No preview equivalent: the accent is picked, not dragged, so the write and
  // the repaint are the same moment. This window repainting itself the instant a
  // swatch is clicked is why the picker needs no preview swatch of its own.
  useAccentColor(api.settings.accentColor)

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

  // Each pane scrolls in the same element, so without this a long About scrolled
  // halfway would hand Settings its scroll offset and open it mid-row.
  useEffect(() => {
    body.current?.scrollTo({ top: 0 })
  }, [pane])

  const current = PANES.find((entry) => entry.id === pane) ?? PANES[0]

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
        {/* This window used to paint a local scrim over the Mica base, because at
            the design file's .80 the desktop read straight through a wall of body
            copy. The base alpha is a preference now (`--mica-alpha`), so the scrim
            is gone: two stacked opacities meant the slider could never actually
            make this window transparent, and every surface in the app now answers
            to the same number. */}

        {/* Above .mica::before (noise) and .mica::after (hairline). */}
        <div style={{ position: 'relative', zIndex: 1, height: '100%', display: 'flex' }}>
          {/* ── Nav pane ─────────────────────────────────────────────────────
              Also the drag handle for the left half of the window: it is mostly
              empty space, which makes it the easiest part of a borderless window
              to grab. */}
          <nav
            data-tauri-drag-region
            style={{
              width: SIDEBAR,
              flex: 'none',
              display: 'flex',
              flexDirection: 'column',
              padding: 8,
              borderRight: `1px solid ${color.dividerStrong}`,
              background: 'rgba(255,255,255,.02)',
            }}
          >
            <div
              data-tauri-drag-region
              style={{
                height: 44,
                flex: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '0 6px',
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
                Crest
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 6 }}>
              {PANES.map((entry) => (
                <NavItem
                  key={entry.id}
                  pane={entry}
                  active={entry.id === pane}
                  onSelect={setPane}
                />
              ))}
            </div>

            <span data-tauri-drag-region style={{ flex: 1 }} />

            <div
              data-tauri-drag-region
              style={{ padding: '0 6px 4px', fontSize: 11, color: color.text.muted }}
            >
              Version {version || '—'}
            </div>
          </nav>

          {/* ── Content pane ─────────────────────────────────────────────── */}
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
            {/* The window is borderless, so this strip is the whole title bar for
                the right half: drag handle, current pane's name, and the only way
                to close. */}
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
              <h2
                data-tauri-drag-region
                style={{
                  margin: 0,
                  fontSize: 14,
                  fontWeight: 600,
                  color: color.text.primary,
                }}
              >
                {current.label}
              </h2>

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

            {/* Scrollbars are hidden app-wide, so each pane is sized to fit its
                copy at the default type ramp; scrolling is the fallback, not the
                plan. */}
            <div
              ref={body}
              style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '18px 20px 20px' }}
            >
              {/* `mode="wait"` so the outgoing pane is gone before the incoming one
                  lays out — two panes of different heights in the same scroller
                  otherwise jump the content under the cursor mid-fade. */}
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={pane}
                  initial={{ opacity: 0, x: 6 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -6 }}
                  transition={{ duration: 0.14, ease: 'easeOut' }}
                >
                  {pane === 'about' ? (
                    <AboutPane version={version} />
                  ) : pane === 'panels' ? (
                    <PanelsPane api={api} />
                  ) : pane === 'appearance' ? (
                    <AppearancePane api={api} opacity={opacity} onPreviewOpacity={setPreview} />
                  ) : pane === 'weather' ? (
                    <WeatherPane api={api} />
                  ) : pane === 'notes' ? (
                    <NotesPane />
                  ) : (
                    <SettingsPane api={api} />
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
