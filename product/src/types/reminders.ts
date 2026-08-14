/**
 * Reminders behind the calendar module.
 *
 * Mirrors `Reminder` in `src-tauri/src/reminders.rs`. Rust stores and nothing
 * else; what counts as *due*, what a day is called, and which reminders belong to
 * which square of the month grid are all decided here — they are questions about
 * the user's own clock, and the frontend is the only side that has it.
 */

export interface Reminder {
  id: string
  title: string
  /** Unix millis. An instant, not a wall-clock string — see the Rust module. */
  dueAt: number
  /** When the notch announced it, or null if it has not yet. */
  firedAt: number | null
  done: boolean
}

/**
 * A calendar day as `YYYY-MM-DD` in *local* time.
 *
 * Built by hand rather than with `toISOString().slice(0, 10)`, which is the
 * obvious version and is wrong: that converts to UTC first, so for anyone east of
 * Greenwich a reminder set for 1am lands on the previous day's square. Every
 * grouping in the calendar goes through this one function so they cannot disagree.
 */
export function dayKey(date: Date): string {
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

/** The `dayKey` a reminder falls on. */
export function reminderDay(reminder: Reminder): string {
  return dayKey(new Date(reminder.dueAt))
}

/** `18:30` → the millis of that minute on that day, in local time. */
export function instantFrom(day: string, time: string): number | null {
  const [year, month, date] = day.split('-').map(Number)
  const [hour, minute] = time.split(':').map(Number)
  if (!year || !month || !date || Number.isNaN(hour) || Number.isNaN(minute)) return null
  return new Date(year, month - 1, date, hour, minute, 0, 0).getTime()
}

/** `6:05 PM`, in whatever form the user's locale writes a time. */
export function formatTime(millis: number): string {
  return new Date(millis).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  })
}

/**
 * How a reminder relates to now, for the one line the row has to say it in.
 *
 * Deliberately coarse. "In 3 hours" and "in 3 hours 12 minutes" are the same
 * fact to someone glancing at a card, and the second one changes every minute,
 * which makes a still list look like it is doing something.
 */
export function relativeDue(dueAt: number, now: number): string {
  const minutes = Math.round((dueAt - now) / 60_000)

  if (minutes < -60 * 24) return 'Overdue'
  if (minutes < -1) return `${Math.abs(minutes) < 60 ? `${Math.abs(minutes)}m` : `${Math.round(Math.abs(minutes) / 60)}h`} ago`
  if (minutes <= 1) return 'Now'
  if (minutes < 60) return `in ${minutes}m`
  if (minutes < 60 * 24) return `in ${Math.round(minutes / 60)}h`
  return `in ${Math.round(minutes / (60 * 24))}d`
}
