/**
 * How hard the machine is working, and the moments that are worth interrupting
 * someone about.
 *
 * Mirrors `Performance` in `src-tauri/src/perf.rs`. Rust reports a snapshot and
 * nothing else; what counts as *overload* is decided in `usePerformance`, which
 * is the only thing that sees a run of snapshots — one reading at 100% is a
 * compile finishing, and there is no banner in that.
 *
 * Companion to `types/system.ts` rather than part of it. That file is what is
 * *attached* to the machine; this is what the machine is *doing*. Both end up on
 * the same banner, and neither has anything to say about the other.
 */

export interface Performance {
  /**
   * Processor utility, 0–100 — the number Task Manager's CPU column shows.
   *
   * Null on the very first poll and only then: this, `gpu` and `disk` are rates,
   * and PDH computes a rate between two collections. `memory` and `temperatureC`
   * are readings rather than rates and arrive whole on the first poll.
   */
  cpu: number | null
  /** Committed physical memory, 0–100. Never null — it is a level, not a rate. */
  memory: number
  memoryUsedBytes: number
  memoryTotalBytes: number
  /** The busiest GPU engine class, 0–100. Null where the driver exposes none. */
  gpu: number | null
  /** Disk active time, 0–100, across every physical disk. */
  disk: number | null
  /**
   * The hottest ACPI thermal zone, in °C, or null.
   *
   * Null far more often than the other four, and *low* on many of the machines
   * where it is not: what the firmware exposes as a thermal zone is frequently a
   * board or ambient sensor rather than the CPU package, so a machine reading
   * 28°C under load is reporting honestly about the wrong thing. That is why the
   * meter for it only appears when there is a reading, and why the alert it feeds
   * sits at a temperature no ambient sensor reaches.
   */
  temperatureC: number | null
}

/** Which meter an alert is about. The four loads, plus heat. */
export type PerfMetric = 'cpu' | 'memory' | 'gpu' | 'disk' | 'temperature'

/**
 * Something has been pinned at the top of its range long enough to mean it.
 *
 * Carries the whole snapshot as well as the reading that tripped it, because the
 * useful half of "your CPU is at 97%" is usually one of the other four — a
 * machine thrashing its disk and a machine compiling look identical from the CPU
 * meter alone.
 *
 * `id` is a sequence number stamped by the hook, for the same reason `SystemEvent`
 * carries one: two alerts about the same metric are genuinely two alerts, and the
 * banner's cross-fade keys on it.
 */
export interface PerfAlert {
  id: number
  metric: PerfMetric
  /** The reading that tripped it — percent, or °C for `temperature`. */
  value: number
  /** What it had to cross, so the banner can say what "high" meant here. */
  threshold: number
  /** Everything else at that moment, for the banner's detail line. */
  snapshot: Performance
}

/**
 * What the power row can do. Mirrors `PowerAction` in `perf.rs`.
 *
 * Ordered least to most disruptive, which is also the order they are drawn in —
 * the destructive one ends up furthest from where the cursor enters the card.
 */
export type PowerAction = 'sleep' | 'restart' | 'shutdown'
