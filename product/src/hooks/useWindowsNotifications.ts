import { useEffect, useRef } from 'react'
import { invoke } from '@tauri-apps/api/core'
import type { WinNotification } from '../types/notifications'

/**
 * Watches the Windows notification centre and reports anything that has just
 * arrived, so the notch can announce it.
 *
 * `UserNotificationListener` aggregates every app that raises a toast, the same
 * way the media session manager aggregates every player — so, again, no per-app
 * integrations. Polled rather than subscribed: the WinRT change event is not
 * raised for unpackaged desktop apps, which is what this is.
 *
 * "Just arrived" is an id the previous poll did not have. The first poll after
 * the hook wakes is a baseline and announces nothing, or launching Crest would
 * replay the entire backlog sitting in the notification centre.
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

export function useWindowsNotifications(
  enabled: boolean,
  onArrive: (arrived: WinNotification[]) => void,
) {
  // Held in a ref so a caller re-creating the callback each render does not tear
  // down and restart the poll — which would re-baseline and swallow an arrival.
  const onArriveRef = useRef(onArrive)
  onArriveRef.current = onArrive

  useEffect(() => {
    if (!enabled || !isTauri()) return

    let cancelled = false
    let seen: Set<string> | null = null

    const poll = async () => {
      let current: WinNotification[]
      try {
        current = await invoke<WinNotification[]>('get_windows_notifications')
      } catch {
        // Access denied, or no listener at all. Nothing to report and nothing to
        // be done about it from here — the settings window is where that is
        // explained, and it asks Rust directly.
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
    }

    void poll()
    const id = setInterval(() => void poll(), POLL_MS)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [enabled])
}
