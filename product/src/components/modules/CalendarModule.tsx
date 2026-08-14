import { useEffect, useMemo, useRef, useState } from 'react'
import { getCurrentWindow } from '@tauri-apps/api/window'
import type { ReminderFeed } from '../../hooks/useReminders'
import { color, radius, sectionLabel } from '../../tokens'
import {
  dayKey,
  formatTime,
  instantFrom,
  relativeDue,
  reminderDay,
  type Reminder,
} from '../../types/reminders'

/**
 * A month, and what is on it.
 *
 * Two panes: the grid on the left, and whatever day is selected on the right.
 * That split is what makes a 440px card able to be both a calendar and a to-do
 * list — a month grid alone answers "what is the date" and nothing else, and a
 * flat list of reminders answers "what is next" but loses the shape of the month
 * that makes you notice Thursday is full.
 *
 * **Every box is pinned**, as in the other fixed-content modules: `size.calendar`
 * is the sum of the left pane's boxes and the state machine hit-tests it. The
 * right pane rides at the same height rather than adding to it, which is why the
 * grid is what the arithmetic counts. Six week rows are always drawn, even in a
 * month that only needs five — a grid that changed height between February and
 * March would change the card's height with it, and the notch would resize as you
 * paged through the year.
 *
 * The reminder *list* is not owned here. `useReminders` holds it, announces the
 * ones that come due, and is mounted in `App` — the banner has to keep working
 * while this card has never been opened, which is most of the time.
 */

/* ── Grid geometry. Mirrored by `size.calendar`; change both. ───────────────── */
const HEADER_H = 24
const WEEKDAY_H = 16
const CELL_H = 30
const WEEKS = 6
const GRID_W = 224

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

const isTauri = () => !!(window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__

/**
 * The overlay is created with `focus: false` so it never steals activation. That
 * also means it gets no keystrokes until something asks — which typing a reminder
 * requires. Same trick as `QuickNotes`.
 */
const requestWindowFocus = () => {
  if (!isTauri()) return
  getCurrentWindow().setFocus().catch(() => {})
}

/**
 * The 42 squares of a month view.
 *
 * Always six rows starting from the Sunday on or before the 1st, so the grid is
 * a fixed shape — see the note above about the card resizing. Days from the
 * neighbouring months are included rather than blanked, because the last three
 * days of the previous month are still days you might have put something on.
 */
function monthGrid(year: number, month: number): Date[] {
  const first = new Date(year, month, 1)
  const start = new Date(year, month, 1 - first.getDay())
  return Array.from({ length: WEEKS * 7 }, (_, i) => new Date(year, month, start.getDate() + i))
}

function Chevron({ direction, label, onClick }: { direction: -1 | 1; label: string; onClick: () => void }) {
  const [hover, setHover] = useState(false)

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      onPointerEnter={() => setHover(true)}
      onPointerLeave={() => setHover(false)}
      style={{
        width: 20,
        height: 20,
        flex: 'none',
        display: 'grid',
        placeItems: 'center',
        padding: 0,
        borderRadius: radius.small,
        background: hover ? color.tile : 'transparent',
        transition: 'background 90ms linear',
      }}
    >
      <svg
        viewBox="0 0 24 24"
        width={13}
        height={13}
        fill="none"
        stroke={hover ? color.accent : color.text.muted}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ transition: 'stroke 140ms ease' }}
      >
        {direction === -1 ? <path d="m14 6-6 6 6 6" /> : <path d="m10 6 6 6-6 6" />}
      </svg>
    </button>
  )
}

/** One reminder in the right pane. */
function Row({
  reminder,
  now,
  onToggle,
  onRemove,
}: {
  reminder: Reminder
  now: number
  onToggle: () => void
  onRemove: () => void
}) {
  const [hovered, setHovered] = useState(false)
  const overdue = !reminder.done && reminder.dueAt < now

  return (
    <div
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        height: 30,
        flex: 'none',
        padding: '0 6px',
        margin: '0 -6px',
        borderRadius: radius.small,
        background: hovered ? color.tile : 'transparent',
        transition: 'background 90ms linear',
      }}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-label={reminder.done ? 'Mark as not done' : 'Mark as done'}
        title={reminder.done ? 'Mark as not done' : 'Mark as done'}
        style={{
          width: 14,
          height: 14,
          flex: 'none',
          padding: 0,
          display: 'grid',
          placeItems: 'center',
          borderRadius: 4,
          border: `1.5px solid ${reminder.done ? color.accent : color.text.icon}`,
          background: reminder.done ? color.accent : 'transparent',
          transition: 'background 120ms ease, border-color 120ms ease',
        }}
      >
        {reminder.done && (
          <svg viewBox="0 0 24 24" width={10} height={10} fill="none" stroke="#fff" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round">
            <path d="m5 13 4.5 4.5L19 7" />
          </svg>
        )}
      </button>

      <span style={{ flex: 1, minWidth: 0 }}>
        <span
          style={{
            display: 'block',
            fontSize: 11.5,
            color: reminder.done ? color.text.muted : color.text.strong,
            textDecoration: reminder.done ? 'line-through' : undefined,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {reminder.title}
        </span>
        <span
          style={{
            display: 'block',
            fontSize: 9.5,
            // Overdue is the one state worth colouring: it is the difference
            // between a plan and a thing that has been missed.
            color: overdue ? color.fileRed : color.text.muted,
          }}
        >
          {formatTime(reminder.dueAt)}
          {!reminder.done && ` · ${relativeDue(reminder.dueAt, now)}`}
        </span>
      </span>

      {/* Only on hover: a delete button visible on every row turns a list you
          read into a list you have to be careful in. */}
      {hovered && (
        <button
          type="button"
          onClick={onRemove}
          aria-label="Delete reminder"
          title="Delete"
          style={{ width: 16, height: 16, flex: 'none', padding: 0, display: 'grid', placeItems: 'center' }}
        >
          <svg viewBox="0 0 24 24" width={12} height={12} fill="none" stroke={color.text.muted} strokeWidth={1.8} strokeLinecap="round">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      )}
    </div>
  )
}

export default function CalendarModule({ feed }: { feed: ReminderFeed }) {
  const { reminders, loaded, add, remove, toggleDone } = feed

  const [draft, setDraft] = useState('')
  const [time, setTime] = useState('18:00')
  const inputRef = useRef<HTMLInputElement>(null)

  /**
   * A clock, so "in 20m" is still true a minute later.
   *
   * A minute rather than a second: every string this feeds is rounded to minutes
   * or hours, so a faster tick would re-render the card to draw the same words.
   */
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(id)
  }, [])

  // Derived from the clock rather than captured once at mount. The notch runs for
  // weeks, and a "today" pinned to whenever the process started would leave the
  // ring on the wrong square from the first midnight onward.
  const today = useMemo(() => new Date(now), [now])

  const [selected, setSelected] = useState(() => dayKey(new Date()))
  const [cursor, setCursor] = useState(() => {
    const start = new Date()
    return { year: start.getFullYear(), month: start.getMonth() }
  })

  const grid = useMemo(() => monthGrid(cursor.year, cursor.month), [cursor])

  /**
   * Reminders bucketed by day, so a square can ask "is there anything on me"
   * without walking the whole list — 42 squares × the list, on every render,
   * otherwise.
   */
  const byDay = useMemo(() => {
    const map = new Map<string, Reminder[]>()
    for (const reminder of reminders) {
      const key = reminderDay(reminder)
      const bucket = map.get(key)
      if (bucket) bucket.push(reminder)
      else map.set(key, [reminder])
    }
    return map
  }, [reminders])

  const todayKey = dayKey(today)
  const dayReminders = byDay.get(selected) ?? []

  const selectedDate = useMemo(() => {
    const [year, month, day] = selected.split('-').map(Number)
    return new Date(year, month - 1, day)
  }, [selected])

  const monthLabel = new Date(cursor.year, cursor.month, 1).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  })

  const submit = () => {
    const at = instantFrom(selected, time)
    if (at === null) return
    add(draft, at)
    setDraft('')
    // Focus is kept: adding two reminders in a row is the common case, and
    // reaching back for the field between them is friction for nothing.
    inputRef.current?.focus()
  }

  const step = (direction: -1 | 1) =>
    setCursor(({ year, month }) => {
      const next = new Date(year, month + direction, 1)
      return { year: next.getFullYear(), month: next.getMonth() }
    })

  return (
    <div style={{ width: '100%', height: '100%', padding: 16, display: 'flex', gap: 14 }}>
      {/* ── The month ─────────────────────────────────────────────────────── */}
      <div style={{ width: GRID_W, flex: 'none', display: 'flex', flexDirection: 'column' }}>
        <div
          style={{
            height: HEADER_H,
            flex: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <span
            style={{
              flex: 1,
              minWidth: 0,
              fontSize: 12.5,
              fontWeight: 600,
              color: color.text.primary,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {monthLabel}
          </span>
          <Chevron direction={-1} label="Previous month" onClick={() => step(-1)} />
          <Chevron direction={1} label="Next month" onClick={() => step(1)} />
        </div>

        <div style={{ height: 8, flex: 'none' }} />

        <div
          style={{
            height: WEEKDAY_H,
            flex: 'none',
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
          }}
        >
          {WEEKDAYS.map((letter, index) => (
            <span
              key={index}
              style={{
                ...sectionLabel,
                fontSize: 9,
                letterSpacing: 0,
                textAlign: 'center',
                lineHeight: `${WEEKDAY_H}px`,
              }}
            >
              {letter}
            </span>
          ))}
        </div>

        <div
          style={{
            height: CELL_H * WEEKS,
            flex: 'none',
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            gridTemplateRows: `repeat(${WEEKS}, ${CELL_H}px)`,
          }}
        >
          {grid.map((date) => {
            const key = dayKey(date)
            const outside = date.getMonth() !== cursor.month
            const isToday = key === todayKey
            const isSelected = key === selected
            const marks = byDay.get(key)
            const pending = marks?.some((reminder) => !reminder.done) ?? false

            return (
              <button
                key={key}
                type="button"
                onClick={() => setSelected(key)}
                title={date.toLocaleDateString(undefined, { dateStyle: 'full' })}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 2,
                  padding: 0,
                  borderRadius: radius.small,
                  // Selection is a fill, today is a ring. Two different questions
                  // — "where am I looking" and "what day is it" — and on the day
                  // they coincide both marks are legible at once.
                  background: isSelected ? color.accent : 'transparent',
                  boxShadow: isToday && !isSelected ? `inset 0 0 0 1px ${color.accent}` : undefined,
                  transition: 'background 120ms ease',
                }}
              >
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: isToday ? 700 : 400,
                    fontVariantNumeric: 'tabular-nums',
                    lineHeight: 1,
                    color: isSelected
                      ? '#fff'
                      : outside
                        ? color.text.muted
                        : color.text.strong,
                    // Neighbouring months are present but recessive — reachable,
                    // never competing with the month you asked for.
                    opacity: outside && !isSelected ? 0.45 : 1,
                  }}
                >
                  {date.getDate()}
                </span>

                {/* One dot, not a count. A square is 30px and "how many" is the
                    right pane's job; this only has to say "something is here". */}
                <span
                  style={{
                    width: 3,
                    height: 3,
                    borderRadius: '50%',
                    background: !marks
                      ? 'transparent'
                      : isSelected
                        ? '#fff'
                        : pending
                          ? color.accent
                          : color.text.muted,
                  }}
                />
              </button>
            )
          })}
        </div>
      </div>

      <div style={{ width: 1, background: color.dividerStrong, flex: 'none' }} />

      {/* ── The day ───────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <div style={{ height: HEADER_H, flex: 'none' }}>
          <div style={{ ...sectionLabel, lineHeight: '12px' }}>
            {selected === todayKey
              ? 'Today'
              : selectedDate.toLocaleDateString(undefined, { weekday: 'long' })}
          </div>
          <div style={{ fontSize: 12, fontWeight: 600, color: color.text.primary, marginTop: 2 }}>
            {selectedDate.toLocaleDateString(undefined, { day: 'numeric', month: 'long' })}
          </div>
        </div>

        <div style={{ height: 8, flex: 'none' }} />

        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
          {dayReminders.length === 0 ? (
            <div
              style={{
                height: '100%',
                display: 'grid',
                placeItems: 'center',
                textAlign: 'center',
                fontSize: 11,
                lineHeight: 1.5,
                color: color.text.muted,
                padding: '0 4px',
              }}
            >
              {/* Nothing at all until the file has been read: an empty state a
                  frame before the data lands would tell someone with a full day
                  that it is clear. */}
              {loaded ? 'Nothing on this day' : ''}
            </div>
          ) : (
            dayReminders.map((reminder) => (
              <Row
                key={reminder.id}
                reminder={reminder}
                now={now}
                onToggle={() => toggleDone(reminder.id)}
                onRemove={() => remove(reminder.id)}
              />
            ))
          )}
        </div>

        <div style={{ height: 8, flex: 'none' }} />

        {/* ── Add ─────────────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', gap: 6, height: 26, flex: 'none' }}>
          <input
            ref={inputRef}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onPointerDown={requestWindowFocus}
            onKeyDown={(event) => {
              if (event.key === 'Enter') submit()
            }}
            placeholder="Get groceries…"
            spellCheck={false}
            style={{
              flex: 1,
              minWidth: 0,
              height: '100%',
              border: 'none',
              outline: 'none',
              padding: '0 8px',
              borderRadius: radius.small,
              background: color.inset,
              boxShadow: color.insetShadow,
              fontFamily: 'inherit',
              fontSize: 11.5,
              color: color.text.body,
              caretColor: color.accent,
              // index.css turns selection off for the overlay chrome; the places
              // the user genuinely types have to opt back in.
              userSelect: 'text',
              WebkitUserSelect: 'text',
            }}
          />

          <input
            type="time"
            value={time}
            onChange={(event) => setTime(event.target.value)}
            onPointerDown={requestWindowFocus}
            aria-label="Time"
            style={{
              width: 68,
              flex: 'none',
              height: '100%',
              border: 'none',
              outline: 'none',
              padding: '0 4px',
              borderRadius: radius.small,
              background: color.inset,
              boxShadow: color.insetShadow,
              fontFamily: 'inherit',
              fontSize: 11,
              color: color.text.body,
              colorScheme: 'dark',
              userSelect: 'text',
              WebkitUserSelect: 'text',
            }}
          />

          <button
            type="button"
            onClick={submit}
            aria-label="Add reminder"
            title="Add reminder"
            disabled={draft.trim().length === 0}
            style={{
              width: 26,
              height: '100%',
              flex: 'none',
              display: 'grid',
              placeItems: 'center',
              padding: 0,
              borderRadius: radius.small,
              background: draft.trim() ? color.accent : color.tile,
              opacity: draft.trim() ? 1 : 0.5,
              cursor: draft.trim() ? 'pointer' : 'default',
              transition: 'background 120ms ease, opacity 120ms ease',
            }}
          >
            <svg viewBox="0 0 24 24" width={13} height={13} fill="none" stroke="#fff" strokeWidth={2} strokeLinecap="round">
              <path d="M12 6v12M6 12h12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}
