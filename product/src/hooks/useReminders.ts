import { useCallback, useEffect, useRef, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import type { Reminder } from '../types/reminders'

/**
 * The reminder list, and the thing that notices one has come due.
 *
 * Two jobs in one hook for the same reason `useWindowsNotifications` has two: the
 * calendar draws the standing list and the banner reports an arrival, and both
 * are answers from the same array. A second hook would mean a second read of the
 * same file and a second copy of "which of these have already fired".
 *
 * **The clock is checked every 20 seconds, not every second.** A reminder set for
 * 6:00pm that arrives at 6:00:14pm is on time by any standard a sticky note is
 * held to, and a per-second timer in an always-running overlay is a per-second
 * wake for the life of the process.
 *
 * **`firedAt` is written to disk**, which is the part that is easy to get wrong.
 * An in-memory "already announced" set would replay every overdue reminder every
 * time the app restarts — and the notch restarts on every update. Persisting it
 * also means a reminder that came due while Crest was closed is announced once,
 * on the next launch, rather than never or forever.
 *
 * Writes are optimistic and whole-file, as in `useQuickNotes`: the list is a few
 * kilobytes, and a partial update would need a merge story for a file only this
 * hook writes.
 */

/** How often the clock is checked against the list. */
const TICK_MS = 20_000

/**
 * How far past its time a reminder may be and still be announced.
 *
 * Something has to bound it, or launching Crest after a fortnight away throws up
 * a banner for a dentist appointment from last Tuesday. Twelve hours covers a
 * machine that was asleep overnight — which is the case worth catching — and
 * stops at the point where "you have a thing at 6" stops being useful. Anything
 * older is still in the list, still on its day in the calendar, just not shouted
 * about.
 */
const STALE_MS = 12 * 60 * 60 * 1000

const isTauri = () => !!(window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__

const STORAGE_KEY = 'dynamic-notch-reminders'

export interface ReminderFeed {
  reminders: Reminder[]
  /** False until the first read settles. Distinguishes "empty" from "not yet". */
  loaded: boolean
  add: (title: string, dueAt: number) => void
  remove: (id: string) => void
  toggleDone: (id: string) => void
}

async function persist(next: Reminder[]) {
  try {
    if (isTauri()) await invoke('write_reminders', { reminders: next })
    else localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch (err) {
    console.error('reminders: save failed', err)
  }
}

export function useReminders(
  /** Whether due reminders are announced. The list is kept either way. */
  announce: boolean,
  onDue: (reminder: Reminder) => void,
): ReminderFeed {
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [loaded, setLoaded] = useState(false)

  // Refs for the reasons every poll in this directory has them: a caller that
  // rebuilds the callback each render must not restart the tick, and the latest
  // list has to be readable by the tick without making it a dependency.
  const onDueRef = useRef(onDue)
  onDueRef.current = onDue
  const announceRef = useRef(announce)
  announceRef.current = announce
  const listRef = useRef<Reminder[]>([])
  listRef.current = reminders
  const loadedRef = useRef(loaded)
  loadedRef.current = loaded

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      let stored: Reminder[] = []
      try {
        if (isTauri()) {
          const file = await invoke<{ reminders: Reminder[] }>('read_reminders')
          stored = file?.reminders ?? []
        } else {
          stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
        }
      } catch (err) {
        console.error('reminders: load failed', err)
      }
      if (cancelled) return

      setReminders(stored)
      setLoaded(true)
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [])

  /** Apply a change, store it, and keep the ref in step for the tick. */
  const commit = useCallback((next: Reminder[]) => {
    listRef.current = next
    setReminders(next)
    void persist(next)
  }, [])

  const add = useCallback(
    (title: string, dueAt: number) => {
      const trimmed = title.trim()
      if (!trimmed) return

      const reminder: Reminder = {
        id: crypto.randomUUID(),
        title: trimmed,
        dueAt,
        // A reminder added for a time that has already passed is not announced.
        // The user typed the time; being told about it a second later is the app
        // reading their own input back to them.
        firedAt: dueAt <= Date.now() ? Date.now() : null,
        done: false,
      }
      // Sorted on write rather than on render: every reader wants it in time
      // order, and sorting in the component would redo it on every poll tick.
      commit([...listRef.current, reminder].sort((a, b) => a.dueAt - b.dueAt))
    },
    [commit],
  )

  const remove = useCallback(
    (id: string) => commit(listRef.current.filter((reminder) => reminder.id !== id)),
    [commit],
  )

  const toggleDone = useCallback(
    (id: string) =>
      commit(
        listRef.current.map((reminder) =>
          reminder.id === id ? { ...reminder, done: !reminder.done } : reminder,
        ),
      ),
    [commit],
  )

  // The clock.
  useEffect(() => {
    const tick = () => {
      // Nothing has been read yet, so an empty list is not evidence of anything.
      if (!loadedRef.current) return

      const now = Date.now()
      const due = listRef.current.find(
        (reminder) =>
          !reminder.done &&
          reminder.firedAt === null &&
          reminder.dueAt <= now &&
          now - reminder.dueAt < STALE_MS,
      )

      // Anything older than the stale window is marked fired without a banner, so
      // it stops being reconsidered every twenty seconds for the rest of the
      // session — and so it cannot suddenly announce itself if the clock moves.
      const expired = listRef.current.filter(
        (reminder) => reminder.firedAt === null && now - reminder.dueAt >= STALE_MS,
      )

      if (expired.length > 0) {
        const ids = new Set(expired.map((reminder) => reminder.id))
        commit(
          listRef.current.map((reminder) =>
            ids.has(reminder.id) ? { ...reminder, firedAt: now } : reminder,
          ),
        )
        return
      }

      if (!due) return

      // Marked fired whether or not it is announced. With the preference off the
      // user has said they do not want banners, and turning it back on next week
      // should not replay everything that came due in between.
      commit(
        listRef.current.map((reminder) =>
          reminder.id === due.id ? { ...reminder, firedAt: now } : reminder,
        ),
      )

      if (announceRef.current) onDueRef.current(due)
    }

    // One tick straight away: a reminder that came due while Crest was closed
    // should not wait twenty seconds after launch. `loaded` is a dependency
    // purely so that this immediate tick happens *after* the list arrives —
    // without it the first one runs against an empty array and the catch-up
    // waits for the interval anyway.
    tick()
    const id = setInterval(tick, TICK_MS)
    return () => clearInterval(id)
  }, [commit, loaded])

  return { reminders, loaded, add, remove, toggleDone }
}
