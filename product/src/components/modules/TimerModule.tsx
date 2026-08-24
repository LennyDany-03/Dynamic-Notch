import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import ProgressTrace from '../timer/ProgressTrace'
import RollingDigits from '../timer/RollingDigits'
import { armChime } from '../timer/chime'
import type { TimerFeed } from '../../hooks/useTimer'
import { color, radius, scaleDuration } from '../../tokens'
import {
  describeDuration,
  digitsToMs,
  elapsedFraction,
  msToDigits,
  phaseOf,
  remainingMs,
  splitDigits,
} from '../../types/timer'

/**
 * The timer card: six numerals, an outline that fills as they run down, and a
 * band of controls that stays out of the way until you reach for it.
 *
 * **The digits are the input.** There is no separate field, no picker and no
 * stepper — clicking the readout starts editing it, and typed digits fill
 * `HHMMSS` from the right the way a phone timer does, so 5-3-0 is five minutes
 * thirty. That is the fastest entry there is for the shape of thing people
 * actually set, and it means the card carries exactly one object in both modes
 * rather than growing a control panel when it is idle.
 *
 * Which also settles the native-popup question before it is asked: there is no
 * `<select>`, no `<input type="time">` and no date control anywhere in here. See
 * `TimePicker` for what those do to a 560×420 always-on-top overlay — the popup
 * opens outside the rect `layout.contentRect` hit-tests, the notch counts the
 * cursor as away, and the card collapses out from under a popup still on screen.
 *
 * **Every box is pinned and the height never changes**, which is the rule
 * `layout.contentRect` enforces and the one this card could most easily break.
 * Idle fills the action band with presets and Start; running and paused fill the
 * same band with Pause and Reset. The arithmetic is `size.timer`: 26 nav + 14
 * padding + 96 readout + 8 + 32 band + 14 padding = 190. A card that grew when
 * you pressed Start would resize the notch under a cursor that had just clicked
 * and is therefore not moving.
 */

/** The readout block — the box the trace is drawn around. */
const READOUT_H = 96

/** The action band. Fixed, and the same in all three modes. */
const BAND_H = 32

const GAP = 8
const PADDING = 14

/** How the numerals are set. See `RollingDigits`. */
const SCALE = { size: 58, unit: 20, gap: 14 } as const

/** Radius of the perimeter trace. The tile radius, opened up for a box this size. */
const TRACE_RADIUS = 14

/**
 * The presets.
 *
 * Four, and these four: a minute is "check on this", five and ten are the
 * everyday ones, and twenty-five is a pomodoro, which is the single most common
 * reason anyone opens a timer at a desk. More than four and the row stops being
 * scannable; fewer and the typed entry is doing work a chip should.
 */
const PRESETS = [
  { label: '1m', ms: 60_000 },
  { label: '5m', ms: 5 * 60_000 },
  { label: '10m', ms: 10 * 60_000 },
  { label: '25m', ms: 25 * 60_000 },
] as const

/** Longest duration the field will accept: 99h 59m 59s. */
const MAX_DIGITS = 6

function Action({
  label,
  onClick,
  primary,
  children,
}: {
  label: string
  onClick: () => void
  primary?: boolean
  children: React.ReactNode
}) {
  const [hover, setHover] = useState(false)

  return (
    <button
      type="button"
      onClick={onClick}
      onPointerEnter={() => setHover(true)}
      onPointerLeave={() => setHover(false)}
      title={label}
      aria-label={label}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        height: 26,
        padding: '0 10px',
        flex: 'none',
        borderRadius: radius.small,
        fontSize: 11.5,
        fontWeight: 600,
        letterSpacing: '.01em',
        // Accent fill on the primary action only, per the design rule that the
        // accent marks an active state rather than decorating a surface. Start is
        // the one control on this card that is the *point* of it.
        background: primary
          ? color.accent
          : hover
            ? color.hoverStrong
            : color.tile,
        color: primary ? color.onAccent : hover ? color.text.primary : color.text.body,
        transition: 'background 140ms ease, color 140ms ease',
      }}
    >
      {children}
      {label}
    </button>
  )
}

/** Stroke-only glyphs, matching the app's own set. */
function Glyph({ path, fill }: { path: string; fill?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={12}
      height={12}
      fill={fill ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={fill ? 0 : 1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ flex: 'none' }}
    >
      <path d={path} />
    </svg>
  )
}

export default function TimerModule({
  feed,
  animationSpeed,
}: {
  feed: TimerFeed
  /** The notch's motion speed, threaded down to the digit roll. */
  animationSpeed: number
}) {
  const { timer, now, start, pause, resume, reset } = feed
  const phase = phaseOf(timer)
  const reduced = useReducedMotion() ?? false

  /**
   * What has been typed, as a digit string, or null when the field is not being
   * edited.
   *
   * Null rather than "the current duration as digits" so that the two states are
   * genuinely distinct: while null the readout shows the *timer*, and while a
   * string it shows what is being typed. Collapsing them would mean a running
   * timer and a half-typed duration were the same value in different clothes.
   */
  const [draft, setDraft] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  /**
   * Whether keystrokes are currently going in. Drives the caret, and nothing else.
   *
   * **Deliberately separate from `draft`, and blur does not clear the draft.**
   * The obvious version has one piece of state and discards it on blur, and it
   * loses the user's input at the worst possible moment: blur and click are
   * separate discrete events, so clicking Start after typing fires blur first,
   * React re-renders with the draft gone, and the *new* Start handler starts the
   * previous duration instead of the one just typed. Keeping the composed
   * duration until it is launched or explicitly abandoned is what makes the field
   * behave the way it looks like it behaves.
   */
  const [focused, setFocused] = useState(false)

  // Editing is only ever an idle-state thing. Starting, resuming or a timer
  // landing while the field is open has to close it, or the card would show a
  // stale draft over a running countdown.
  useEffect(() => {
    if (phase !== 'idle') {
      setDraft(null)
      setFocused(false)
    }
  }, [phase])

  const draftMs = draft !== null ? digitsToMs(draft) : 0
  const editing = draft !== null

  // What the numerals show: the draft while composing, the timer otherwise.
  const shown = editing ? draftMs : remainingMs(timer, now)
  const { h, m, s } = splitDigits(shown)

  /** The duration Start would run: whatever is on screen. */
  const pending = editing ? draftMs : timer.durationMs

  const beginEdit = useCallback(() => {
    if (phase !== 'idle') return
    // Seeded from whatever the card is already showing, so clicking into a
    // finished 5:00 and typing a digit extends it rather than starting from
    // nothing — and Backspace from there does what it looks like it does.
    setDraft((current) => current ?? msToDigits(timer.durationMs))
    // Focus has to happen after the input exists. It is rendered unconditionally
    // (see below) precisely so this needs no timeout.
    inputRef.current?.focus()
  }, [phase, timer.durationMs])

  const launch = useCallback(
    (ms: number) => {
      if (ms <= 0) return
      // The gesture that makes the chime possible. This is the click a user
      // makes to start a timer, and it is the only one guaranteed to happen
      // before a chime is ever due — see `chime.ts` for why an AudioContext
      // built anywhere else is silently mute in WebView2.
      armChime()
      setDraft(null)
      setFocused(false)
      start(ms)
    },
    [start],
  )

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === 'Enter') {
        event.preventDefault()
        launch(pending)
        return
      }
      if (event.key === 'Escape') {
        event.preventDefault()
        // The one gesture that *does* discard the draft. Blur no longer does, so
        // there has to be a way to put the card back to the stored duration.
        setDraft(null)
        setFocused(false)
        inputRef.current?.blur()
        return
      }
      if (event.key === 'Backspace') {
        event.preventDefault()
        setDraft((current) => (current ?? '').slice(0, -1))
        return
      }
      if (/^[0-9]$/.test(event.key)) {
        event.preventDefault()
        setDraft((current) => {
          // Leading zeros are dropped as they shift off the left, so the field
          // cannot fill up with padding the user never typed and then refuse
          // real digits.
          const next = `${(current ?? '').replace(/^0+/, '')}${event.key}`
          return next.length > MAX_DIGITS ? next.slice(-MAX_DIGITS) : next
        })
      }
    },
    [launch, pending],
  )

  // The trace's own reading. While editing it shows nothing rather than the
  // finished timer's full outline: the field is a duration being composed, and a
  // full ring beside it would say a timer had just completed.
  const progress = editing ? 0 : elapsedFraction(timer, now)

  const fade = scaleDuration(0.14, animationSpeed)

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        padding: `0 ${PADDING}px ${PADDING}px`,
        display: 'flex',
        flexDirection: 'column',
        gap: GAP,
      }}
    >
      {/* ── The readout ────────────────────────────────────────────────────
          A button, because it is one: clicking it is how a duration gets
          typed. Rendered as a plain div while a timer runs, so a running
          countdown is not a control that appears to do something on click. */}
      <div
        style={{
          position: 'relative',
          height: READOUT_H,
          flex: 'none',
          display: 'grid',
          placeItems: 'center',
        }}
      >
        <ProgressTrace
          progress={progress}
          // Off while paused and while editing: a CSS transition would otherwise
          // animate the outline from wherever it was to wherever it now is, which
          // on resume reads as the timer jumping.
          animate={phase === 'running'}
          radius={TRACE_RADIUS}
        />

        {/* The keyboard's way in. Rendered always, sized to nothing, and never
            visible — the numerals are what the user sees and this is what
            receives the keystrokes. A `readOnly` input rather than a live one:
            every keystroke is handled above and the field's own value is never
            read, so the browser must not also be maintaining one. */}
        <input
          ref={inputRef}
          readOnly
          inputMode="numeric"
          aria-label="Timer duration. Type digits to set it."
          value=""
          onKeyDown={onKeyDown}
          onFocus={() => setFocused(true)}
          // Only the caret goes. See `focused` above for why the draft stays.
          onBlur={() => setFocused(false)}
          style={{
            position: 'absolute',
            width: 1,
            height: 1,
            opacity: 0,
            padding: 0,
            border: 'none',
            outline: 'none',
            pointerEvents: 'none',
          }}
        />

        <button
          type="button"
          onClick={beginEdit}
          // Only a control while it is one. A running timer is a readout, and a
          // readout that highlights under the cursor is promising something.
          disabled={phase !== 'idle'}
          aria-label={
            phase === 'idle'
              ? `Set the timer. Currently ${describeDuration(shown)}.`
              : `${describeDuration(shown)} remaining`
          }
          style={{
            position: 'relative',
            display: 'grid',
            placeItems: 'center',
            width: '100%',
            height: '100%',
            padding: 0,
            borderRadius: TRACE_RADIUS,
            background: 'transparent',
            cursor: phase === 'idle' ? 'text' : 'default',
          }}
        >
          <RollingDigits
            hours={h}
            minutes={m}
            seconds={s}
            scale={SCALE}
            animationSpeed={animationSpeed}
            reduced={reduced}
            label={
              phase === 'running'
                ? `${describeDuration(shown)} remaining`
                : phase === 'paused'
                  ? `Paused, ${describeDuration(shown)} remaining`
                  : describeDuration(shown)
            }
          />

          {/* The caret. Only while editing, and only a mark — there is nowhere
              sensible to put a real one under six centred columns, and what it
              has to say is "this is live", not "the cursor is here". */}
          {editing && focused && (
            <span
              className="timer-caret"
              aria-hidden
              style={{
                position: 'absolute',
                bottom: 12,
                width: 46,
                height: 2,
                borderRadius: 2,
                background: color.accent,
              }}
            />
          )}
        </button>
      </div>

      {/* ── The action band ────────────────────────────────────────────────
          Fixed height in all three modes, so the card never resizes.

          While a timer runs the band is *empty* until the cursor enters it,
          which is the whole of "the digits dominate": the notch grows downward
          out of the pill, so the cursor arrives at the top of the card and the
          running card genuinely reads as numerals alone until you reach for a
          control. Hovering the band rather than the card, because the card is
          hovered by definition — the notch is only ever expanded because the
          cursor is on it, so a card-level reveal would be permanently on and
          would not be a reveal at all. */}
      <div
        style={{
          height: BAND_H,
          flex: 'none',
          // Positioned, so the two bands can occupy it at once. See below.
          position: 'relative',
        }}
      >
        {/* Overlapping rather than sequential, which is the same correction
            `NotchShell` records for its panel cross-fade: `mode="wait"` holds the
            incoming band until the outgoing one has finished leaving, so pressing
            Start costs two fades end to end and leaves the band visibly *empty*
            in between — a control strip that blinks out at the exact moment you
            have just used it. Overlapping them costs one fade and nothing is ever
            missing. Absolute positioning is what lets both sit in the box. */}
        <AnimatePresence initial={false}>
          {phase === 'idle' ? (
            <motion.div
              key="set"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: fade }}
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
              }}
            >
              {PRESETS.map((preset) => (
                <PresetChip
                  key={preset.label}
                  label={preset.label}
                  active={!editing && timer.durationMs === preset.ms}
                  // Sets, and deliberately does not start. A mis-clicked preset
                  // that started immediately costs a running timer; a second
                  // click on Start costs a click.
                  //
                  // Focus goes back to the field, so a preset is a starting point
                  // you can keep typing from rather than a dead end that needs
                  // the digits clicked again before the keyboard works.
                  onClick={() => {
                    setDraft(msToDigits(preset.ms))
                    inputRef.current?.focus()
                  }}
                />
              ))}

              <span
                aria-hidden
                style={{ width: 1, height: 16, background: color.divider, margin: '0 2px' }}
              />

              <Action label="Start" primary onClick={() => launch(pending)}>
                <Glyph path="M8 5.5v13l11-6.5z" fill />
              </Action>
            </motion.div>
          ) : (
            <RunningControls
              key="running"
              paused={phase === 'paused'}
              onPause={pause}
              onResume={resume}
              onReset={reset}
              fade={fade}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

function PresetChip({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  const [hover, setHover] = useState(false)

  return (
    <button
      type="button"
      onClick={onClick}
      onPointerEnter={() => setHover(true)}
      onPointerLeave={() => setHover(false)}
      aria-pressed={active}
      style={{
        height: 26,
        padding: '0 10px',
        flex: 'none',
        borderRadius: radius.small,
        fontSize: 11.5,
        fontWeight: 600,
        fontVariantNumeric: 'tabular-nums',
        background: active ? color.accentWash : hover ? color.hover : 'transparent',
        color: active ? color.accent : hover ? color.text.primary : color.text.secondary,
        transition: 'background 140ms ease, color 140ms ease',
      }}
    >
      {label}
    </button>
  )
}

/**
 * Pause / Resume and Reset, revealed by the cursor entering the band.
 *
 * Its own component so the hover state lives with the thing that has it, and so
 * the reveal cannot accidentally be keyed on the card.
 */
function RunningControls({
  paused,
  onPause,
  onResume,
  onReset,
  fade,
}: {
  paused: boolean
  onPause: () => void
  onResume: () => void
  onReset: () => void
  fade: number
}) {
  const [hover, setHover] = useState(false)

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: fade }}
      onPointerEnter={() => setHover(true)}
      onPointerLeave={() => setHover(false)}
      // The band's full width and height, so entering it anywhere reveals the
      // controls rather than only entering the buttons themselves — which would
      // be a reveal you had to already know about to trigger.
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
      }}
    >
      {/* A paused timer shows its controls unconditionally. Paused is a state the
          user has to be able to get *out* of, and hiding the way out behind a
          hover on a card that looks stopped is how a timer gets abandoned. */}
      <motion.div
        animate={{ opacity: hover || paused ? 1 : 0 }}
        transition={{ duration: fade }}
        style={{ display: 'flex', alignItems: 'center', gap: 6 }}
      >
        {paused ? (
          <Action label="Resume" primary onClick={onResume}>
            <Glyph path="M8 5.5v13l11-6.5z" fill />
          </Action>
        ) : (
          <Action label="Pause" onClick={onPause}>
            <Glyph path="M9.5 5.5v13M14.5 5.5v13" />
          </Action>
        )}

        <Action label="Reset" onClick={onReset}>
          <Glyph path="M4.5 9.5a8 8 0 1 1 .6 5M4.5 4.8v4.7h4.7" />
        </Action>
      </motion.div>
    </motion.div>
  )
}
