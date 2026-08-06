import { useEffect, useState } from 'react'

/**
 * Wall clock for the collapsed pill.
 *
 * Re-arms onto each minute boundary rather than ticking every second. The pill
 * only renders hours and minutes, so a 1s interval would re-render 59 times for
 * nothing — and this is an always-on overlay that is meant to cost nothing while
 * idle. Aiming at the boundary also means the displayed minute flips when it
 * actually changes, instead of up to a minute late.
 */
export function useClock() {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>

    const tick = () => {
      const at = new Date()
      setNow(at)
      const untilNextMinute = 60_000 - (at.getSeconds() * 1000 + at.getMilliseconds())
      timer = setTimeout(tick, untilNextMinute)
    }

    tick()
    return () => clearTimeout(timer)
  }, [])

  return now
}

/**
 * Hours and minutes in the user's own locale, so a 12- or 24-hour clock follows
 * their Windows setting rather than a hardcoded choice.
 */
export function formatClock(at: Date) {
  return at.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}
