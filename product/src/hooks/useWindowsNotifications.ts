import { useCallback, useEffect, useRef, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import type { WinNotification } from '../types/notifications'

/**
 * Watches the Windows notification centre: reports anything that has just
 * arrived, so the notch can announce it, and keeps the standing list, so the
 * notifications module can show what is still there.
 *
 * One poll for both. The banner and the list are the same data seen twice — one
 * arrival, and everything not yet dismissed — and a second poll would double the
 * WinRT round trips to answer a question this one already answered.
 *
 * `UserNotificationListener` aggregates every app that raises a toast, the same
 * way the media session manager aggregates every player — so, again, no per-app
 * integrations. Polled rather than subscribed: the WinRT change event is not
 * raised for unpackaged desktop apps, which is what this is.
 *
 * "Just arrived" is an id the previous poll did not have. The first poll after
 * the hook wakes is a baseline and announces nothing, or launching Crest would
 * replay the entire backlog sitting in the notification centre. The *list* has no
 * such baseline — the backlog is exactly what it is for, and it is populated from
 * that very first poll.
 *
 * The seen set is pruned to what the centre still holds, which keeps it from
 * growing for the life of the process. The trade is that dismissing a
 * notification and having the same id come back would re-announce it — ids are
 * not reused while an entry is live, so that only happens when the notification
 * genuinely returns.
 *
 * Arrivals are reported as a batch because a poll can find several at once —
 * unlocking the machine after an hour away finds the whole backlog — and the
 * caller wants to show one banner, not ten in a row. `GetNotificationsAsync`
 * does not specify an order, so there is no "newest" to pick out of a batch;
 * whichever is shown, the rest are exactly where Windows left them.
 */

/** Slow enough to be cheap all day, fast enough that a banner still feels caused. */
const POLL_MS = 2000

const isTauri = () => !!(window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__

export interface NotificationFeed {
  /**
   * Everything in the notification centre, newest first.
   *
   * Sorted here rather than in the module because it is the poll that knows the
   * order is arbitrary — `GetNotificationsAsync` makes no promise, and two
   * consecutive polls could hand back the same set in a different order and
   * reshuffle a list the user is reading.
   */
  notifications: WinNotification[]
  /** False until the first poll settles. An empty list before that means "not yet". */
  loaded: boolean
  /**
   * The poll is being refused — no listener, or Windows not granting access to
   * the notification centre. There is nothing to be done about it from the notch;
   * it is here so an empty list can say why it is empty.
   */
  unavailable: boolean
  /** Drop one entry from the centre, then reconcile against the next poll. */
  dismiss: (id: string) => void
  /** Empty the centre. */
  clearAll: () => void
  /** Hide an entry in Crest and announce it again after a short delay. */
  snooze: (notification: WinNotification, durationMs: number) => void
}

export function useWindowsNotifications(
  enabled: boolean,
  onArrive: (arrived: WinNotification[]) => void,
): NotificationFeed {
  // Held in a ref so a caller re-creating the callback each render does not tear
  // down and restart the poll — which would re-baseline and swallow an arrival.
  const onArriveRef = useRef(onArrive)
  onArriveRef.current = onArrive

  const [notifications, setNotifications] = useState<WinNotification[]>([])
  const [loaded, setLoaded] = useState(false)
  const [unavailable, setUnavailable] = useState(false)
  const snoozedRef = useRef(new Set<string>())
  const snoozeTimersRef = useRef(new Map<string, ReturnType<typeof setTimeout>>())

  useEffect(() => {
    if (!enabled || !isTauri()) {
      // Switching the preference off empties the list rather than freezing the
      // last poll on screen: the notch has stopped watching, and a stale list
      // would keep claiming otherwise.
      setNotifications([])
      setLoaded(false)
      setUnavailable(false)
      return
    }

    let cancelled = false
    let seen: Set<string> | null = null

    const poll = async () => {
      let current: WinNotification[]
      try {
        current = await invoke<WinNotification[]>('get_windows_notifications')
      } catch {
        // Access denied, or no listener at all. Nothing to report and nothing to
        // be done about it from here — the settings window is where that is
        // explained, and it asks Rust directly. The module says only that the
        // centre is out of reach.
        if (!cancelled) {
          setUnavailable(true)
          setLoaded(true)
        }
        return
      }
      if (cancelled) return

      const ids = new Set(current.map((notification) => notification.id))

      if (seen) {
        const previous = seen
        const arrived = current.filter((notification) => !previous.has(notification.id))
        if (arrived.length) onArriveRef.current(arrived)
      }

      seen = ids
      setNotifications(
        current
          .filter((notification) => !snoozedRef.current.has(notification.id))
          .sort((a, b) => b.timestamp - a.timestamp),
      )
      setUnavailable(false)
      setLoaded(true)
    }

    void poll()
    const id = setInterval(() => void poll(), POLL_MS)
    return () => {
      cancelled = true
      clearInterval(id)
      for (const timer of snoozeTimersRef.current.values()) clearTimeout(timer)
      snoozeTimersRef.current.clear()
    }
  }, [enabled])

  /**
   * Removing an entry drops it from the list immediately rather than waiting for
   * the next poll. Up to two seconds of a row still sitting there after it was
   * dismissed reads as the click not having registered, and the poll is the
   * authority either way — it puts the row back if the removal did not take.
   */
  const dismiss = useCallback((id: string) => {
    setNotifications((current) => current.filter((notification) => notification.id !== id))
    // Windows' own id is numeric; it crosses the bridge as a string because that
    // is what it is used as everywhere else here (map keys, React keys).
    void invoke('dismiss_notification', { id: Number(id) }).catch(() => {})
  }, [])

  const clearAll = useCallback(() => {
    setNotifications([])
    void invoke('clear_all_notifications').catch(() => {})
  }, [])

  const snooze = useCallback((notification: WinNotification, durationMs: number) => {
    const existing = snoozeTimersRef.current.get(notification.id)
    if (existing) clearTimeout(existing)

    snoozedRef.current.add(notification.id)
    setNotifications((current) => current.filter((entry) => entry.id !== notification.id))
    const timer = setTimeout(() => {
      snoozeTimersRef.current.delete(notification.id)
      snoozedRef.current.delete(notification.id)
      onArriveRef.current([notification])
    }, durationMs)
    snoozeTimersRef.current.set(notification.id, timer)
  }, [])

  return { notifications, loaded, unavailable, dismiss, clearAll, snooze }
}
