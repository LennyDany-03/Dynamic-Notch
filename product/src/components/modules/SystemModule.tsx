import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react'
import { motion } from 'framer-motion'
import { invoke } from '@tauri-apps/api/core'
import { color, radius, sectionLabel } from '../../tokens'
import type { Performance, PowerAction } from '../../types/perf'

/**
 * The system monitor — four load meters, a temperature when the firmware offers
 * one, and the three power actions.
 *
 * The card behind the overload banner, in the same way the notifications list is
 * the card behind the notification banner: the banner says one metric went high
 * and leaves, and this is where the other three are, which is usually where the
 * answer is. A CPU at 97% means one thing next to a disk at 4% and something
 * else entirely next to a disk at 99%.
 *
 * **Every box here is pinned to an explicit height**, for the same reason they
 * are in `NotificationsModule`: `size.system` in `tokens.ts` is the sum of them,
 * and the state machine hit-tests that number. A row that measured itself would
 * leave the card either clipped or holding the notch open over a stripe of empty
 * Mica. The arithmetic is written out at `size.system`.
 *
 * ## Why the power row is here at all
 *
 * It is the only thing on the notch that acts on the machine rather than
 * reporting it, and it sits next to the meters because that is where the reason
 * to use it comes from — a laptop that is hot and pegged wants sleeping, and
 * Windows buries that three clicks into a menu that itself needs the Start menu
 * open. But the notch expands on *hover*, which makes a live "Shut down" button a
 * genuinely dangerous control: a cursor travelling to a browser tab could take
 * the machine down with one stray click.
 *
 * So every action is armed before it fires. The first click turns the row into a
 * question, the second answers it, and the arming expires by itself after
 * `ARM_MS` — which matters more than it looks, because the notch collapses on its
 * own timer and a card that is re-opened later must not still be holding a primed
 * shutdown button.
 */

/** The four meters and the power row are all pinned. See `size.system`. */
const HEADER_H = 16
const METER_H = 34
const POWER_H = 34

/** How long a power action stays armed before it forgets it was ever asked. */
const ARM_MS = 4000

/** Above this a meter is warm, above the second it is hot. See `color.load`. */
const WARN_AT = 75
const HOT_AT = 90

function toneFor(percent: number): string {
  if (percent >= HOT_AT) return color.load.hot
  if (percent >= WARN_AT) return color.load.warn
  return color.load.busy
}

/** Bytes as the "11.4 GB" a user reads off Task Manager, not as a binary count. */
function gigabytes(bytes: number): string {
  return `${(bytes / 1e9).toFixed(1)} GB`
}

/**
 * One load meter: a name, a reading, and a bar.
 *
 * The bar is scaled rather than width-animated — one compositor property instead
 * of a layout pass every poll, the same reason `PowerGlyph` scales its fill — and
 * it springs rather than cutting, so a meter that jumps 40 points reads as the
 * machine moving rather than as the card redrawing.
 *
 * `value` is null for a reading this machine does not have (no GPU counters, and
 * every rate on the very first poll). The row stays, dimmed, with an em dash: a
 * meter that vanished would move the three below it every time the poll hiccuped.
 */
function Meter({
  label,
  value,
  detail,
}: {
  label: string
  /** 0–100, or null where there is no reading. */
  value: number | null
  /** The qualifier after the percentage — used bytes, for memory. */
  detail?: string
}) {
  const known = value !== null
  const percent = Math.max(0, Math.min(100, value ?? 0))

  return (
    <div
      style={{
        height: METER_H,
        flex: 'none',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        gap: 5,
        opacity: known ? 1 : 0.45,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span style={{ fontSize: 11, fontWeight: 500, color: color.text.secondary }}>{label}</span>

        <span style={{ flex: 1 }} />

        {detail && <span style={{ fontSize: 10.5, color: color.text.muted }}>{detail}</span>}

        <span
          style={{
            fontSize: 11.5,
            fontWeight: 600,
            color: color.text.strong,
            // Stops the column twitching between 9% and 10% every poll.
            fontVariantNumeric: 'tabular-nums',
            minWidth: 34,
            textAlign: 'right',
          }}
        >
          {known ? `${Math.round(percent)}%` : '—'}
        </span>
      </div>

      <div
        style={{
          height: 5,
          borderRadius: radius.pill,
          background: color.scrubTrack,
          overflow: 'hidden',
        }}
      >
        <motion.div
          initial={false}
          animate={{ scaleX: known ? percent / 100 : 0 }}
          transition={{ type: 'spring', stiffness: 220, damping: 30, mass: 0.7 }}
          style={{
            width: '100%',
            height: '100%',
            borderRadius: radius.pill,
            background: toneFor(percent),
            transformOrigin: 'left center',
            // Not animated with the bar: a colour that sprang alongside the
            // length would read as two separate things changing.
            transition: 'background 260ms ease',
          }}
        />
      </div>
    </div>
  )
}

interface PowerButton {
  id: PowerAction
  label: string
  /** What the armed row asks. Phrased as the question the second click answers. */
  question: string
  icon: ReactElement
  danger?: boolean
}

const stroke = {
  fill: 'none',
  strokeWidth: 1.5,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" width={14} height={14} {...stroke} stroke="currentColor" style={{ flex: 'none' }}>
      {children}
    </svg>
  )
}

const POWER: PowerButton[] = [
  {
    id: 'sleep',
    label: 'Sleep',
    question: 'Sleep now?',
    icon: (
      <Icon>
        <path d="M20 13.5A8.5 8.5 0 1 1 10.5 4a6.7 6.7 0 0 0 9.5 9.5z" />
      </Icon>
    ),
  },
  {
    id: 'restart',
    label: 'Restart',
    question: 'Restart now?',
    icon: (
      <Icon>
        <path d="M20 12a8 8 0 1 1-2.5-5.8" />
        <path d="M20 4v4h-4" />
      </Icon>
    ),
  },
  {
    id: 'shutdown',
    label: 'Shut down',
    question: 'Shut down now?',
    danger: true,
    icon: (
      <Icon>
        <path d="M12 3.5v8" />
        <path d="M7.6 6.6a7.5 7.5 0 1 0 8.8 0" />
      </Icon>
    ),
  },
]

/**
 * The three power actions, and the confirmation they arm into.
 *
 * The whole row is replaced while armed rather than one button changing under the
 * cursor: the second click has to be a deliberate answer to a question, and a
 * button that quietly relabels itself in place is the same click landing twice.
 */
function PowerRow() {
  const [armed, setArmed] = useState<PowerAction | null>(null)
  const [hovered, setHovered] = useState<string | null>(null)
  const [failed, setFailed] = useState<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const disarm = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = null
    setArmed(null)
  }, [])

  const arm = (action: PowerAction) => {
    if (timerRef.current) clearTimeout(timerRef.current)
    setFailed(null)
    setArmed(action)
    timerRef.current = setTimeout(() => {
      timerRef.current = null
      setArmed(null)
    }, ARM_MS)
  }

  // The notch collapses on its own timer while this card is open, and the card is
  // unmounted with it. Without this, the pending disarm outlives the component.
  useEffect(() => () => disarm(), [disarm])

  const confirm = (action: PowerAction) => {
    disarm()
    // Never resolves on success: the machine is going away. A rejection is
    // Windows refusing — a driver vetoing sleep, or the privilege being denied —
    // and the row says so rather than looking like the click was missed.
    void invoke('power_action', { action }).catch((reason) =>
      setFailed(typeof reason === 'string' && reason ? reason : "Windows wouldn't do that."),
    )
  }

  const question = POWER.find((button) => button.id === armed)

  if (question) {
    return (
      <div style={{ height: POWER_H, flex: 'none', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span
          style={{
            flex: 1,
            minWidth: 0,
            fontSize: 12,
            fontWeight: 600,
            color: question.danger ? color.load.hot : color.text.strong,
          }}
        >
          {question.question}
        </span>

        <button
          type="button"
          onClick={disarm}
          style={{
            height: 26,
            padding: '0 12px',
            borderRadius: radius.tile,
            fontSize: 11.5,
            color: color.text.secondary,
            background: color.tile,
          }}
        >
          Cancel
        </button>

        <button
          type="button"
          onClick={() => confirm(question.id)}
          style={{
            height: 26,
            padding: '0 12px',
            borderRadius: radius.tile,
            fontSize: 11.5,
            fontWeight: 600,
            color: '#fff',
            background: question.danger ? color.load.hot : color.accent,
          }}
        >
          Confirm
        </button>
      </div>
    )
  }

  if (failed) {
    return (
      <div style={{ height: POWER_H, flex: 'none', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ flex: 1, minWidth: 0, fontSize: 11.5, color: color.fileRed }}>{failed}</span>
        <button
          type="button"
          onClick={() => setFailed(null)}
          style={{
            height: 26,
            padding: '0 12px',
            borderRadius: radius.tile,
            fontSize: 11.5,
            color: color.text.secondary,
            background: color.tile,
          }}
        >
          Dismiss
        </button>
      </div>
    )
  }

  return (
    <div style={{ height: POWER_H, flex: 'none', display: 'flex', gap: 8 }}>
      {POWER.map((button) => {
        const isHovered = hovered === button.id
        const tint = button.danger ? color.load.hot : color.text.strong

        return (
          <button
            key={button.id}
            type="button"
            className="tile"
            title={button.label}
            onClick={() => arm(button.id)}
            onPointerEnter={() => setHovered(button.id)}
            onPointerLeave={() => setHovered(null)}
            style={{
              flex: 1,
              minWidth: 0,
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 7,
              borderRadius: radius.tile,
              fontSize: 11.5,
              fontWeight: 500,
              color: isHovered ? tint : color.text.body,
              background: isHovered
                ? button.danger
                  ? 'rgba(248,113,113,.12)'
                  : 'rgba(255,255,255,.10)'
                : undefined,
              transition: 'background 90ms linear, color 90ms linear',
            }}
          >
            <span style={{ display: 'flex', color: isHovered ? tint : color.text.icon }}>
              {button.icon}
            </span>
            {button.label}
          </button>
        )
      })}
    </div>
  )
}

export default function SystemModule({ performance }: { performance: Performance | null }) {
  const temperature = performance?.temperatureC ?? null

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        style={{
          height: HEADER_H,
          flex: 'none',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <span style={sectionLabel}>System monitor</span>

        <span style={{ flex: 1 }} />

        {/* Only when the firmware gives one, and never as a meter: what Windows
            exposes as a thermal zone is an ambient sensor as often as it is the
            CPU package, so a bar implying "x% of the way to too hot" would be
            reading a scale this number is not on. A figure is honest. */}
        {temperature !== null && (
          <span
            className="tile"
            style={{
              display: 'flex',
              alignItems: 'center',
              height: 16,
              padding: '0 7px',
              borderRadius: radius.pill,
              overflow: 'hidden',
              fontSize: 10.5,
              fontWeight: 600,
              fontVariantNumeric: 'tabular-nums',
              color: temperature >= 85 ? color.load.hot : color.text.secondary,
            }}
          >
            {Math.round(temperature)}°C
          </span>
        )}
      </div>

      <div style={{ height: 10, flex: 'none' }} />

      <Meter label="CPU" value={performance?.cpu ?? null} />
      <Meter
        label="Memory"
        value={performance?.memory ?? null}
        detail={
          performance && performance.memoryTotalBytes > 0
            ? `${gigabytes(performance.memoryUsedBytes)} / ${gigabytes(performance.memoryTotalBytes)}`
            : undefined
        }
      />
      <Meter label="GPU" value={performance?.gpu ?? null} />
      <Meter label="Disk" value={performance?.disk ?? null} />

      <div style={{ flex: 1, minHeight: 12 }} />

      <PowerRow />
    </div>
  )
}
