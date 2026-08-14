import { useState } from 'react'
import { motion } from 'framer-motion'
import { THEMES, type ThemeId } from '../../hooks/useSettings'
import { color, radius, spring } from '../../tokens'

/**
 * The theme picker — five palettes, each shown as a miniature of the thing it
 * changes.
 *
 * **The preview is drawn by the theme itself.** Each card scopes a
 * `data-theme` attribute over its preview panel, which is the same hook
 * `useTheme` puts on `:root`, so the panel inherits that palette's whole block
 * from `index.css` — surface, tile, text, accent and all. Nothing here holds a
 * colour. That is not tidiness for its own sake: a picker with its own copy of
 * five palettes is a picker that can be wrong about them, and wrong in the one
 * place a user has no way to check before committing.
 *
 * The scope stops at the preview. The name and the sentence beside it are drawn
 * in the palette that is *currently* running, because they are this window's
 * copy rather than part of the sample — Mono's muted grey on Daylight's white
 * would be an unreadable label for a theme that reads perfectly well.
 *
 * Why a miniature notch rather than a row of swatches: five colours in a line
 * say what a theme contains, not what it looks like. The thing being chosen is a
 * surface with type on it, so the sample is a surface with type on it — the card
 * the user will actually spend their time looking at, at a size that fits five
 * of them on a pane. The swatch strip is underneath as the index, not the answer.
 */

/** Preview panel. Sized so five cards fit the pane without it becoming a scroller. */
const PREVIEW = { width: 124, height: 66 }

/**
 * The hairline separating a sample from the window it sits in.
 *
 * A literal, and the one in this file. Everything inside a preview is scoped to
 * the theme being previewed, so a `var()` here would resolve to *that* palette —
 * an edge drawn in Daylight's near-white, which is exactly the case where the
 * sample most needs separating from a dark window around it. A mid grey at low
 * alpha is the one value that reads against both sides of every pairing.
 */
const SAMPLE_EDGE = 'inset 0 0 0 1px rgba(128,128,128,.35)'

/** The palette, in the order a swatch strip reads best: ground, surface, accent, type. */
const SWATCHES = [
  { key: 'base', fill: 'rgba(var(--mica-rgb),1)' },
  { key: 'tile', fill: 'var(--tile)' },
  { key: 'accent', fill: 'var(--accent)' },
  { key: 'text', fill: 'var(--text-primary)' },
  { key: 'muted', fill: 'var(--text-muted)' },
]

/**
 * A miniature of the media card, drawn entirely from inherited custom properties.
 *
 * Static rather than animated, unlike the real equalizer: five of these on one
 * pane, all pulsing, would be the loudest thing in a window about preferences.
 */
function Preview({ theme }: { theme: ThemeId }) {
  return (
    <div
      data-theme={theme}
      aria-hidden
      style={{
        width: PREVIEW.width,
        height: PREVIEW.height,
        flex: 'none',
        padding: 10,
        display: 'flex',
        alignItems: 'center',
        borderRadius: radius.tile,
        // Opaque, unlike a real card: this is a sample of a palette, and letting
        // the settings window's own surface show through it would blend the two
        // themes into a third that nothing will ever look like. It is also why
        // `--mica-alpha` is deliberately not used here — the opacity preference
        // is a separate control with its own row.
        background: 'rgba(var(--mica-rgb),1)',
        boxShadow: SAMPLE_EDGE,
        overflow: 'hidden',
      }}
    >
      <div
        className="tile"
        style={{
          width: '100%',
          padding: '7px 8px',
          display: 'flex',
          alignItems: 'center',
          gap: 7,
        }}
      >
        <div
          style={{
            width: 22,
            height: 22,
            flex: 'none',
            borderRadius: radius.small,
            background: color.artGradient,
          }}
        />

        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 8.5,
              fontWeight: 600,
              color: color.text.strong,
              whiteSpace: 'nowrap',
            }}
          >
            Now playing
          </div>
          {/* In the accent, because on this card the track title is what the
              accent is actually used for — an active state, not a highlight. */}
          <div
            style={{
              marginTop: 1,
              fontSize: 8,
              color: color.accent,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            Better When I’m Dancin’
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 1.5, height: 11, flex: 'none' }}>
          {[6, 11, 4, 8].map((height, index) => (
            <span
              key={index}
              style={{
                width: 1.5,
                height,
                borderRadius: 1,
                background: color.accentBright,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

export default function ThemePicker({
  value,
  onChange,
}: {
  value: ThemeId
  onChange: (theme: ThemeId) => void
}) {
  const [hovered, setHovered] = useState<ThemeId | null>(null)

  return (
    <div role="radiogroup" aria-label="Theme" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {THEMES.map((theme) => {
        const active = theme.id === value

        return (
          <button
            key={theme.id}
            role="radio"
            aria-checked={active}
            onMouseEnter={() => setHovered(theme.id)}
            onMouseLeave={() => setHovered(null)}
            onClick={() => {
              // A repaint of every window in three processes' worth of webviews
              // is not a no-op worth spending on the theme that is already set.
              if (!active) onChange(theme.id)
            }}
            style={{
              position: 'relative',
              width: '100%',
              padding: 10,
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              borderRadius: radius.tile,
              textAlign: 'left',
              background: active ? color.accentWashSoft : hovered === theme.id ? color.hover : 'transparent',
              transition: 'background 90ms linear',
            }}
          >
            {active && (
              // One shared element, as in the sidebar and the accent swatches:
              // picking a theme slides the outline across rather than blinking it
              // out of one card and into the next, which is what makes the five
              // read as one control.
              <motion.span
                layoutId="theme-ring"
                transition={spring.peek}
                style={{
                  position: 'absolute',
                  inset: 0,
                  borderRadius: radius.tile,
                  boxShadow: `inset 0 0 0 1.5px ${color.accent}`,
                  pointerEvents: 'none',
                }}
              />
            )}

            <Preview theme={theme.id} />

            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: color.text.primary }}>
                  {theme.name}
                </span>
                {active && (
                  <span
                    style={{
                      padding: '1px 6px',
                      borderRadius: radius.pill,
                      background: color.accentWash,
                      fontSize: 9.5,
                      fontWeight: 600,
                      letterSpacing: '.06em',
                      textTransform: 'uppercase',
                      color: color.text.strong,
                    }}
                  >
                    In use
                  </span>
                )}
              </span>

              <span
                style={{
                  display: 'block',
                  marginTop: 3,
                  fontSize: 11.5,
                  lineHeight: 1.45,
                  color: color.text.muted,
                }}
              >
                {theme.tagline}
              </span>

              {/* The palette itself, in the theme's own scope — the index under
                  the sample, for someone comparing two themes rather than
                  reading one. */}
              <span
                data-theme={theme.id}
                aria-hidden
                style={{ display: 'flex', gap: 4, marginTop: 8 }}
              >
                {SWATCHES.map((swatch) => (
                  <span
                    key={swatch.key}
                    style={{
                      width: 13,
                      height: 13,
                      borderRadius: 3,
                      background: swatch.fill,
                      // Every chip carries an edge rather than only the ones that
                      // happen to need it today: the ground swatch and the type
                      // swatch are each invisible against one of the five
                      // surfaces this strip can be drawn on.
                      boxShadow: SAMPLE_EDGE,
                    }}
                  />
                ))}
              </span>
            </span>
          </button>
        )
      })}
    </div>
  )
}
