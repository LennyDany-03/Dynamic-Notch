import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { color, radius, spring } from '../../tokens'

/**
 * A time picker that stays inside the notch.
 *
 * This exists because `<input type="time">` cannot. Its picker is drawn by the
 * browser as a *native popup* — a real OS window, positioned by Chromium, sized
 * to whatever it feels like and free to extend past the edges of the page. In an
 * ordinary app that is exactly what you want. Here the page is a 560×420
 * transparent overlay pinned to the top of the screen, so the popup opened
 * downward across the desktop, painted over whatever the user was working in, and
 * sat entirely outside the rect `layout.contentRect` hit-tests — which means the
 * notch counted the cursor as "away" the moment it moved onto the list, started
 * its grace timer, and collapsed the card out from under the popup that was still
 * on screen.
 *
 * So: a panel drawn inside the card, in the card's own coordinate space, where
 * the geometry already works. Three columns, because that is the shape everyone
 * already knows from Windows' own picker, and there is nothing to gain by being
 * clever with a control people use without reading.
 *
 * The value is 24-hour `HH:MM` — the same string `<input type="time">` used, so
 * `instantFrom` is untouched — while the face is 12-hour, because that is what
 * the screenshots this replaced were showing and what most Windows installs are
 * set to.
 */

/** One option row. Also the scroll step, so a column lands on whole items. */
const ITEM_H = 26

/** How many rows are visible at once. Odd, so the selection can sit centred. */
const VISIBLE = 5

const HOURS = Array.from({ length: 12 }, (_, i) => i + 1)

/**
 * Five-minute steps rather than sixty rows.
 *
 * A reminder is not a stopwatch — "6:00" and "6:35" are the shapes people
 * actually pick — and sixty rows in a 130px column is a scroll nobody wants. The
 * *stored* value is still a full minute, so a reminder set from anywhere else is
 * shown exactly as it is and can be re-picked to the nearest step.
 */
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5)

const MERIDIEM = ['AM', 'PM'] as const

/** `"18:30"` → `{ hour12: 6, minute: 30, meridiem: 'PM' }`. */
function parse(value: string) {
  const [rawHour, rawMinute] = value.split(':').map(Number)
  const hour24 = Number.isFinite(rawHour) ? Math.min(23, Math.max(0, rawHour)) : 18
  const minute = Number.isFinite(rawMinute) ? Math.min(59, Math.max(0, rawMinute)) : 0

  return {
    hour12: hour24 % 12 === 0 ? 12 : hour24 % 12,
    minute,
    meridiem: (hour24 < 12 ? 'AM' : 'PM') as (typeof MERIDIEM)[number],
  }
}

function toValue(hour12: number, minute: number, meridiem: string) {
  // 12 AM is midnight and 12 PM is noon — the one case where the arithmetic is
  // not `hour + 12`, and the one everybody's first version gets wrong.
  const base = hour12 % 12
  const hour24 = meridiem === 'PM' ? base + 12 : base
  return `${`${hour24}`.padStart(2, '0')}:${`${minute}`.padStart(2, '0')}`
}

/** How the trigger reads. Same 12-hour face as the columns. */
export function faceOf(value: string): string {
  const { hour12, minute, meridiem } = parse(value)
  return `${hour12}:${`${minute}`.padStart(2, '0')} ${meridiem}`
}

function Column<T extends string | number>({
  options,
  value,
  onSelect,
  label,
}: {
  options: readonly T[]
  value: T
  onSelect: (next: T) => void
  label: string
}) {
  const ref = useRef<HTMLDivElement>(null)

  // Scroll the selection into view when the panel opens, without animating —
  // `useLayoutEffect` so it happens before paint and the column is never seen
  // jumping from the top to wherever the current value is.
  useLayoutEffect(() => {
    const index = options.indexOf(value)
    if (index >= 0 && ref.current) {
      ref.current.scrollTop = Math.max(0, (index - Math.floor(VISIBLE / 2)) * ITEM_H)
    }
    // Deliberately only on mount: re-running on every selection would fight a
    // user who has scrolled the column to look at something else.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div
      ref={ref}
      role="listbox"
      aria-label={label}
      style={{
        width: 46,
        height: ITEM_H * VISIBLE,
        flex: 'none',
        overflowY: 'auto',
        scrollSnapType: 'y mandatory',
      }}
    >
      {options.map((option) => {
        const active = option === value
        return (
          <button
            key={String(option)}
            type="button"
            role="option"
            aria-selected={active}
            onClick={() => onSelect(option)}
            style={{
              width: '100%',
              height: ITEM_H,
              display: 'grid',
              placeItems: 'center',
              padding: 0,
              scrollSnapAlign: 'center',
              borderRadius: radius.small,
              fontSize: 12,
              fontWeight: active ? 600 : 400,
              fontVariantNumeric: 'tabular-nums',
              color: active ? color.onAccent : color.text.secondary,
              background: active ? color.accent : 'transparent',
              transition: 'background 120ms ease, color 120ms ease',
            }}
          >
            {typeof option === 'number' ? `${option}`.padStart(2, '0') : option}
          </button>
        )
      })}
    </div>
  )
}

export default function TimePicker({
  value,
  onChange,
}: {
  /** 24-hour `HH:MM`. */
  value: string
  onChange: (next: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [hovered, setHovered] = useState(false)
  const { hour12, minute, meridiem } = parse(value)

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const set = (next: { hour12?: number; minute?: number; meridiem?: string }) =>
    onChange(
      toValue(next.hour12 ?? hour12, next.minute ?? minute, next.meridiem ?? meridiem),
    )

  return (
    <div style={{ position: 'relative', flex: 'none' }}>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        onPointerEnter={() => setHovered(true)}
        onPointerLeave={() => setHovered(false)}
        aria-haspopup="dialog"
        aria-expanded={open}
        title="Pick a time"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 5,
          height: 26,
          padding: '0 8px',
          borderRadius: radius.small,
          background: open ? color.accentWash : color.inset,
          boxShadow: open ? undefined : color.insetShadow,
          fontSize: 11,
          fontVariantNumeric: 'tabular-nums',
          color: open || hovered ? color.text.primary : color.text.body,
          transition: 'background 120ms ease, color 120ms ease',
        }}
      >
        <svg viewBox="0 0 24 24" width={11} height={11} fill="none" stroke={open ? color.accent : color.text.icon} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7.5V12l3 1.8" />
        </svg>
        {faceOf(value)}
      </button>

      <AnimatePresence>
        {open && (
          <>
            {/* Click-away. Only covers the card, which is the only part of this
                window that receives clicks at all — outside it the overlay is in
                `setIgnoreCursorEvents`, so a wider backdrop would catch nothing
                and cost nothing. */}
            <div
              onPointerDown={() => setOpen(false)}
              style={{ position: 'fixed', inset: 0, zIndex: 1 }}
            />

            <motion.div
              className="mica"
              role="dialog"
              aria-label="Pick a time"
              initial={{ opacity: 0, y: 6, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 6, scale: 0.97 }}
              transition={spring.peek}
              style={{
                position: 'absolute',
                // Upward and rightward from the trigger, which sits at the bottom
                // left of the day pane — the one direction with room left inside
                // the card, and the whole reason this panel exists rather than
                // the native one that opened downward across the desktop.
                bottom: 'calc(100% + 6px)',
                left: 0,
                zIndex: 2,
                display: 'flex',
                gap: 2,
                padding: 4,
                borderRadius: radius.tile,
                boxShadow: color.popShadow,
              }}
            >
              <Column
                label="Hour"
                options={HOURS}
                value={hour12}
                onSelect={(next) => set({ hour12: next })}
              />
              <Column
                label="Minute"
                options={MINUTES}
                value={
                  // A stored 6:37 is not on the five-minute grid, so nothing is
                  // highlighted rather than a nearby value pretending to be it.
                  MINUTES.includes(minute) ? minute : -1
                }
                onSelect={(next) => set({ minute: next })}
              />
              <Column
                label="AM or PM"
                options={MERIDIEM}
                value={meridiem}
                onSelect={(next) => set({ meridiem: next })}
              />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
