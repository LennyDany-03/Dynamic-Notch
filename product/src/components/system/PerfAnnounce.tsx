import { PerfGlyph } from './SystemGlyphs'
import { color } from '../../tokens'
import type { PerfAlert, PerfMetric } from '../../types/perf'

/**
 * The machine is struggling — on the same banner the media, notification and
 * system announcements use.
 *
 * The same three-line ramp as `SystemAnnounce`, so the eye lands in the same
 * place whichever banner comes down: what raised it, the thing itself, and the
 * detail that qualifies it. What is different is the third line, and it is the
 * reason this banner earns its place at all.
 *
 * "CPU at 97%" on its own is not actionable — every machine hits that, and a user
 * who is told it and nothing else learns only that Crest is watching. The detail
 * line is therefore always the *other* meters, never a restatement of the one
 * that tripped: a CPU at 97% next to a disk at 4% is a build, and next to a disk
 * at 99% it is a machine paging itself to death. Those want different responses,
 * and the difference fits in eleven characters.
 *
 * Read-only, like the other three, but for a different reason: there *is*
 * something to do about this one, and it is one hover away. This banner dwells
 * through to the system monitor (see `useNotchState`), where the rest of the
 * meters and the power row are. Putting a "Sleep" button on a banner that appears
 * unbidden under a moving cursor is the thing `SystemModule` arms its own buttons
 * to prevent.
 */

/** What each metric is called on the banner's second line. */
const NAMES: Record<PerfMetric, string> = {
  cpu: 'CPU',
  memory: 'Memory',
  gpu: 'GPU',
  disk: 'Disk',
  temperature: 'Temperature',
}

/** How the reading itself is written — a percentage, except for the one that is not. */
function value(metric: PerfMetric, reading: number): string {
  return metric === 'temperature' ? `${Math.round(reading)}°C` : `${Math.round(reading)}%`
}

/**
 * The other meters, in a fixed order and skipping the one that tripped.
 *
 * Fixed rather than sorted by how loaded each is: the banner is on screen for
 * three seconds, and a user who has seen this before should be able to read the
 * third line by position rather than by parsing it. Anything with no reading on
 * this machine is left out entirely — "GPU —" is a fact about the driver, not
 * about the load.
 */
function others(alert: PerfAlert): string {
  const { snapshot, metric } = alert

  const readings: [PerfMetric, number | null][] = [
    ['cpu', snapshot.cpu],
    ['memory', snapshot.memory],
    ['gpu', snapshot.gpu],
    ['disk', snapshot.disk],
    ['temperature', snapshot.temperatureC],
  ]

  const rest = readings
    .filter(([key, reading]) => key !== metric && reading !== null)
    .map(([key, reading]) => `${NAMES[key]} ${value(key, reading as number)}`)

  // Only reachable on a machine reporting exactly one thing, which is the first
  // poll or a virtual machine with no counters. Saying what tripped is better
  // than an empty line under a banner that has already said it once.
  return rest.length > 0 ? rest.join(' · ') : 'Everything else is idle'
}

/**
 * How far round the gauge sweeps.
 *
 * A percentage is itself. A temperature is not on a 0–100 scale in any useful
 * sense — a machine is not "at 62% of hot" — so it is drawn against the band
 * between a cold machine and the threshold it just crossed, which is the only
 * scale the reading has meaning on here.
 */
function gaugeFraction(alert: PerfAlert): number {
  if (alert.metric !== 'temperature') return alert.value / 100
  return Math.min(1, Math.max(0, (alert.value - 40) / (alert.threshold - 40)))
}

/** Warm once it is past the threshold, hot once it is decisively past it. */
function tintFor(alert: PerfAlert): string {
  const over = alert.value - alert.threshold
  return over >= 5 ? color.load.hot : color.load.warn
}

export default function PerfAnnounce({ alert }: { alert: PerfAlert }) {
  const tint = tintFor(alert)

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        padding: '0 14px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        color: color.text.strong,
      }}
    >
      <PerfGlyph metric={alert.metric} fraction={gaugeFraction(alert)} tint={tint} />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 9,
            fontWeight: 600,
            letterSpacing: '.14em',
            textTransform: 'uppercase',
            color: color.text.muted,
          }}
        >
          {/* Two labels, not one: heat and load are different problems with
              different answers, and the label is the line a user reads first. */}
          {alert.metric === 'temperature' ? 'Running hot' : 'Under load'}
        </div>

        <div
          style={{
            fontSize: 13,
            fontWeight: 600,
            letterSpacing: '-.01em',
            marginTop: 1,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {NAMES[alert.metric]} at {value(alert.metric, alert.value)}
        </div>

        <div
          style={{
            fontSize: 11,
            color: color.text.secondary,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {others(alert)}
        </div>
      </div>
    </div>
  )
}
