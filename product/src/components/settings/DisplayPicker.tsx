import { useLayoutEffect, useRef, useState } from 'react'
import { color, font, radius } from '../../tokens'
import type { DisplayInfo } from '../../types/display'

/**
 * Which screen the notch lives on, drawn as a map rather than a list.
 *
 * The map is the whole design decision here. "Display 1" and "Display 2" are two
 * indistinguishable rows of text, and the question the user is actually asking is
 * *the one on my left* or *the one above* — which they can answer instantly from a
 * picture of their own desktop and not at all from a name Windows assigned. So the
 * monitors are laid out in their real relative positions, at their real relative
 * sizes, with a mark on the top edge of the one carrying the notch.
 *
 * It is the same picture Windows' own display settings draws, deliberately: the
 * numbers here are Windows' numbers, so someone who has arranged their screens
 * there already knows which rectangle is which.
 *
 * Two things it does *not* do. It never renders a screen that is not connected,
 * even when the stored preference names one — the preference survives an unplugged
 * monitor (see `display.rs`), but offering a rectangle for a screen that is not
 * there would be drawing a desktop the user does not have. And it draws no
 * selection of its own: `active` comes from Rust, resolved, so what is marked is
 * where the notch *is* rather than what was last clicked. On a machine whose chosen
 * monitor is currently unplugged those are different answers, and the true one is
 * the useful one.
 */

/**
 * The map's height, in px. A ceiling rather than the map: the desktop's own aspect
 * ratio decides how much of it is used, and the map centres in what is left.
 */
const CANVAS_H = 132

/**
 * Width to lay out against before the well has been measured.
 *
 * Measured rather than pinned to a constant, which is what it was: the well is
 * `width: 100%` inside `RowShell` inside the content pane, so its real width is
 * four levels of padding subtracted from the window's — a number that would have
 * to be re-derived by hand every time any of them moved, and whose failure mode is
 * a map quietly clipped against `overflow: hidden`.
 */
const FALLBACK_W = 400

/** Held between the map's edge and the outermost screen, so nothing touches. */
const PAD = 6

export default function DisplayPicker({
  displays,
  onSelect,
  /**
   * Mirroring is on, so every screen has a notch and there is nothing to choose.
   * The map still draws — it is also the answer to "how many screens does Crest
   * see" — but it stops taking clicks and says why.
   */
  disabled = false,
}: {
  displays: DisplayInfo[]
  onSelect: (id: string) => void
  disabled?: boolean
}) {
  const [hovered, setHovered] = useState<string | null>(null)

  // Layout, not effect: the map is positioned from this, and measuring after paint
  // would draw it once at the fallback width and once at the real one.
  //
  // Deliberately no dependency array. The screens arrive asynchronously, so the
  // first render is the empty state — where the well is not in the tree to measure
  // — and a mount-only measurement would keep the fallback width forever on the
  // one path that always happens. Running per render costs a `clientWidth` read
  // and settles immediately: React bails out of a `setState` to the same value, so
  // there is exactly one extra render and no loop.
  const well = useRef<HTMLDivElement>(null)
  const [wellWidth, setWellWidth] = useState(FALLBACK_W)
  useLayoutEffect(() => {
    const width = well.current?.clientWidth
    if (width) setWellWidth(width)
  })

  if (displays.length === 0) {
    return (
      <div
        style={{
          padding: '14px 12px',
          borderRadius: radius.small,
          background: color.inset,
          boxShadow: color.insetShadow,
          fontSize: 11.5,
          color: color.text.muted,
        }}
      >
        Windows isn’t reporting any screens right now. This usually clears itself
        within a few seconds of unlocking or waking the machine.
      </div>
    )
  }

  // Bounding box of the whole virtual desktop, then one scale for every screen —
  // per-screen scaling would draw a 4K panel and a 1080p one the same size, which
  // is exactly the difference the user is pointing at.
  const left = Math.min(...displays.map((d) => d.x))
  const top = Math.min(...displays.map((d) => d.y))
  const right = Math.max(...displays.map((d) => d.x + d.width))
  const bottom = Math.max(...displays.map((d) => d.y + d.height))

  const scale = Math.min(
    (wellWidth - PAD * 2) / Math.max(right - left, 1),
    (CANVAS_H - PAD * 2) / Math.max(bottom - top, 1),
  )

  const mapW = (right - left) * scale
  const mapH = (bottom - top) * scale

  return (
    <div
      ref={well}
      style={{
        // Centred by the flex box rather than by arithmetic against the well's
        // width, so a single screen sits in the middle of it and two side by side
        // stay together as one block.
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: CANVAS_H,
        borderRadius: radius.tile,
        background: color.inset,
        boxShadow: color.insetShadow,
        overflow: 'hidden',
      }}
    >
      <div style={{ position: 'relative', width: mapW, height: mapH, flex: 'none' }}>
        {displays.map((display) => {
          const lit = hovered === display.id && !disabled
          const width = display.width * scale
          const height = display.height * scale

          return (
            <button
              key={display.id}
              type="button"
              disabled={disabled}
              aria-pressed={display.active}
              aria-label={`Put the notch on ${display.name}`}
              onMouseEnter={() => setHovered(display.id)}
              onMouseLeave={() => setHovered(null)}
              onClick={() => onSelect(display.id)}
              style={{
                position: 'absolute',
                left: (display.x - left) * scale,
                top: (display.y - top) * scale,
                width,
                height,
                // Inset by a pixel so two screens that abut in the virtual desktop
                // read as two rectangles rather than one wide one.
                padding: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 2,
                borderRadius: radius.small,
                border: `1.5px solid ${display.active ? color.accent : color.divider}`,
                background: display.active
                  ? color.accentWash
                  : lit
                    ? color.hover
                    : color.tile,
                cursor: disabled ? 'default' : 'pointer',
                transition: 'background 90ms linear, border-color 90ms linear',
              }}
            >
              {/* The notch itself, on the top edge of the screen carrying it, at
                  the end the position preference puts it. Not to scale — at this
                  size a true 560px canvas would be a hairline — but present, which
                  is the whole point: it says *this* is the screen it comes down on. */}
              {display.active && (
                <span
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: Math.max(width * 0.3, 12),
                    height: 3,
                    borderRadius: '0 0 3px 3px',
                    background: color.accent,
                  }}
                />
              )}

              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  lineHeight: 1,
                  color: display.active ? color.text.strong : color.text.secondary,
                }}
              >
                {/* The number alone. The full name is in the list underneath, and
                    at 60px wide anything longer is an ellipsis. */}
                {display.name.replace(/^Display\s+/, '')}
              </span>

              {/* Only where there is room — a small secondary screen next to a
                  large primary can be 40px tall in this map. */}
              {height > 44 && (
                <span
                  style={{
                    fontFamily: font.mono,
                    fontSize: 8.5,
                    lineHeight: 1,
                    color: color.text.muted,
                  }}
                >
                  {display.width}×{display.height}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
