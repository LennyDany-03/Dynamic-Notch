import { useEffect, useRef, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import type { Performance, PerfAlert, PerfMetric } from '../types/perf'

/**
 * Watches how hard the machine is working, hands the standing reading to the
 * system monitor card, and reports an overload once — and only once — when one
 * actually happens.
 *
 * Sibling of `useSystemStatus` and built to the same shape, because the hard part
 * is the same one: a poll produces a snapshot, and something has to decide which
 * snapshots are worth putting on screen. The rules are different, though, and the
 * difference is the whole of this file. A charger going in is an *edge* — it was
 * out, now it is in, and there is exactly one moment to report. A CPU at 96% is a
 * *level*, and levels do not have moments. Every rule below exists to manufacture
 * one honestly.
 *
 * **Sustain.** A reading has to hold above its threshold for `SUSTAIN` polls
 * before it counts. Without it the notch announces every application launch,
 * every Chrome tab, every time Windows Search decides to reindex — all of which
 * peg a core for a second and none of which is a machine in trouble. Six seconds
 * of pegged CPU is.
 *
 * **Hysteresis.** Once reported, a metric does not re-arm until it has come back
 * down past `threshold - RELEASE`. A machine sitting at 90.4% would otherwise
 * cross its own threshold a dozen times a minute and say so each time. Coming
 * back down to 75 is the machine having actually recovered.
 *
 * **Cooldown.** And even then, not within `COOLDOWN_MS` of the last one for that
 * metric. A long build genuinely does load and unload the CPU for half an hour;
 * the user learned what they needed to know from the first banner.
 *
 * **Warm-up.** The first `WARMUP` polls are discarded outright. Crest launching
 * *is* a CPU spike, and the first thing a user should see from this feature is
 * not a banner about the app they just started. It doubles as cover for the first
 * snapshot, where every rate is null by construction.
 *
 * One alert per poll, as in `useSystemStatus`: a machine that is genuinely
 * struggling has all four meters up, and four banners in a row is a notch that
 * will not go away while the user is trying to fix it.
 */

/** Idle cadence, matching `useSystemStatus`. Cheap enough to run all day. */
const POLL_MS = 2000

/**
 * Cadence while the card is actually on screen.
 *
 * Meters that step every two seconds read as broken — the eye expects a monitor
 * to move — and the snapshot behind them costs a millisecond or two, so the whole
 * of the difference is paid only while someone is looking at it. Same trade
 * `useMediaSession` makes with its watch rate, in the same direction.
 */
const POLL_ACTIVE_MS = 1000

/** Polls thrown away at startup, before anything can be announced. */
const WARMUP = 3

/** Consecutive polls above the threshold before a metric is worth a banner. */
const SUSTAIN = 3

/** How far a metric must fall below its threshold before it can alert again. */
const RELEASE = 15

/** Minimum gap between two alerts about the same metric. */
const COOLDOWN_MS = 5 * 60_000

/**
 * Where "high" is, per metric.
 *
 * The three loads sit at 90 rather than 80: a desktop at 85% CPU is a desktop
 * doing its job, and a notch that says so is a notch that gets turned off. Disk
 * is higher again because active-time saturates on any spinning platter and on
 * plenty of SSDs during a large copy, none of which is a problem.
 *
 * Temperature is in °C and set where a laptop is genuinely throttling rather than
 * merely warm. It is also the one that will simply never fire on a machine whose
 * only exposed thermal zone is an ambient sensor — see `Performance.temperatureC`.
 * That is the right failure: a threshold low enough to catch those sensors would
 * announce a warm room on every machine that reports a real one.
 */
const THRESHOLD: Record<PerfMetric, number> = {
  cpu: 90,
  memory: 90,
  gpu: 90,
  disk: 95,
  temperature: 85,
}

const METRICS = Object.keys(THRESHOLD) as PerfMetric[]

/** What the current snapshot says about one metric, or null if it has no reading. */
function reading(snapshot: Performance, metric: PerfMetric): number | null {
  switch (metric) {
    case 'cpu':
      return snapshot.cpu
    case 'memory':
      return snapshot.memory
    case 'gpu':
      return snapshot.gpu
    case 'disk':
      return snapshot.disk
    case 'temperature':
      return snapshot.temperatureC
  }
}

/** Per-metric state carried between polls. */
interface Tracked {
  /** Consecutive polls at or above the threshold. */
  streak: number
  /** When it was last announced, or null if it never has been. */
  reportedAt: number | null
  /** Whether it has come back down far enough to be worth reporting again. */
  armed: boolean
}

const track = (): Map<PerfMetric, Tracked> =>
  new Map(METRICS.map((metric) => [metric, { streak: 0, reportedAt: null, armed: true }]))

const isTauri = () => !!(window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__

/**
 * Whether two snapshots differ in any way a meter would draw.
 *
 * The meters are drawn to a tenth of a percent, so this is not the "did anything
 * change" question `useSystemStatus` asks — under load something always has. It
 * is here for the opposite case: an idle machine reports byte-identical snapshots
 * for minutes at a time, and the card, the pill and every nav strip should not
 * re-render on a timer for them.
 */
function same(a: Performance | null, b: Performance | null): boolean {
  if (!a || !b) return a === b
  return (
    a.cpu === b.cpu &&
    a.memory === b.memory &&
    a.gpu === b.gpu &&
    a.disk === b.disk &&
    a.temperatureC === b.temperatureC &&
    a.memoryUsedBytes === b.memoryUsedBytes
  )
}

export function usePerformance(
  /** Whether the card is on screen, which is the only thing that buys a faster poll. */
  active: boolean,
  /** Whether overloads are announced. Does not stop the poll — the card needs it. */
  announce: boolean,
  onAlert: (alert: PerfAlert) => void,
): Performance | null {
  // Refs for the same reason as everywhere else in this directory: a caller that
  // rebuilds the callback each render must not tear the poll down, and flipping
  // the preference must not either — a restart would blank every meter for a
  // beat and, worse, reset the sustain streaks that are the point of the feature.
  const onAlertRef = useRef(onAlert)
  onAlertRef.current = onAlert
  const announceRef = useRef(announce)
  announceRef.current = announce

  const [performance, setPerformance] = useState<Performance | null>(null)

  // Outside the effect, because the effect restarts whenever the cadence changes
  // and none of this may restart with it. Opening the card must not re-run the
  // warm-up, or a user who opens it *because* the machine is struggling would
  // silence the alert they came for.
  const trackedRef = useRef(track())
  const polledRef = useRef(0)
  const sequenceRef = useRef(0)

  useEffect(() => {
    if (!isTauri()) return

    let cancelled = false

    const poll = async () => {
      let snapshot: Performance
      try {
        snapshot = await invoke<Performance>('get_performance')
      } catch {
        // Nothing to report and nothing to be done from here. Streaks are left
        // alone: a failed round trip is not evidence the load went away.
        return
      }
      if (cancelled) return

      setPerformance((current) => (same(current, snapshot) ? current : snapshot))

      polledRef.current += 1
      if (!announceRef.current || polledRef.current <= WARMUP) return

      const now = Date.now()
      let alert: PerfAlert | null = null

      for (const metric of METRICS) {
        const state = trackedRef.current.get(metric)
        const value = reading(snapshot, metric)
        if (!state || value === null) continue

        const threshold = THRESHOLD[metric]

        if (value < threshold) {
          state.streak = 0
          // Back below the release line: the machine recovered, so the next time
          // this metric climbs is a new event rather than the same one still
          // going on.
          if (value <= threshold - RELEASE) state.armed = true
          continue
        }

        state.streak += 1
        if (state.streak < SUSTAIN || !state.armed) continue
        if (state.reportedAt !== null && now - state.reportedAt < COOLDOWN_MS) continue

        state.reportedAt = now
        state.armed = false

        // First one wins — but the losers are marked reported above rather than
        // queued, exactly as `useSystemStatus` absorbs the rest of a poll into
        // its baseline. They are all still true, they are all on the card the
        // banner opens into, and a second banner about the same struggling
        // machine two seconds later tells the user nothing new.
        //
        // Every metric is walked all the same: the loop is also what advances the
        // other streaks and re-arms whatever has recovered, and breaking out
        // early would freeze all of that behind the busiest meter.
        alert ??= {
          id: ++sequenceRef.current,
          metric,
          value,
          threshold,
          snapshot,
        }
      }

      if (alert) onAlertRef.current(alert)
    }

    void poll()
    const id = setInterval(() => void poll(), active ? POLL_ACTIVE_MS : POLL_MS)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [active])

  return performance
}
