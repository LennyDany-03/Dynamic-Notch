import { AnimatePresence, motion } from 'framer-motion'
import { color, font, scaleSpring, spring } from '../../tokens'

/**
 * The timer readout — `00ʰ 00ᵐ 00ˢ`, set huge, with each digit rolling to its
 * next value rather than cutting to it.
 *
 * The roll is the whole reason this is a component instead of a `<span>`. Six
 * numerals at 58px that snap from 29 to 28 read as a debug readout; the same
 * numerals sliding one position read as a machine keeping time, which is what the
 * card is for. It costs one `AnimatePresence` per digit column and no layout at
 * all, because every column is a fixed box.
 *
 * **Only the columns that changed animate.** Each column keys its glyph on the
 * digit's own value, so the seconds units column rolls every second, its tens
 * column every ten, and the hours column stays perfectly still for an hour. A
 * single key across the whole readout would re-run all six every tick and turn a
 * clock into a slot machine.
 *
 * The unit letters are subscripts rather than a separate line: they are labels on
 * the numbers, not content, so they sit small and muted at the numerals' baseline
 * and never take a share of the eye. They are also what makes the readout legible
 * at a glance as a *duration* rather than a time of day — `05 30 00` could be
 * either, and `05ʰ 30ᵐ 00ˢ` could not.
 */

/** One digit column. Fixed width, so a 1 and an 8 occupy the same box. */
const DIGIT_WIDTH = 0.62

export interface DigitScale {
  /** Numeral size, in px. */
  size: number
  /** Unit-letter size, in px. */
  unit: number
  /** Gap between the h / m / s groups, in px. */
  gap: number
}

function Digit({
  value,
  scale,
  animationSpeed,
  reduced,
}: {
  value: string
  scale: DigitScale
  animationSpeed: number
  reduced: boolean
}) {
  const width = Math.round(scale.size * DIGIT_WIDTH)

  // The card's own content spring, run at the user's speed. The timer is the
  // notch's motion and honours `animationSpeed` exactly as the card spring does —
  // someone who slowed the notch down did not mean "except the timer".
  const transition = scaleSpring(spring.content, animationSpeed)

  if (reduced) {
    // A rolling numeral is precisely the kind of small repeated motion
    // `prefers-reduced-motion` exists to stop, and this one repeats once a
    // second for as long as the timer runs. Cut instead.
    return (
      <span
        style={{
          display: 'inline-block',
          width,
          textAlign: 'center',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value}
      </span>
    )
  }

  return (
    <span
      style={{
        position: 'relative',
        display: 'inline-block',
        width,
        // The column *is* the mask: the outgoing glyph leaves through the bottom
        // edge and the incoming one arrives through the top, and neither is ever
        // seen outside the line box.
        height: scale.size,
        overflow: 'hidden',
        verticalAlign: 'top',
      }}
    >
      <AnimatePresence initial={false}>
        <motion.span
          key={value}
          initial={{ y: '-100%' }}
          animate={{ y: '0%' }}
          exit={{ y: '100%' }}
          transition={transition}
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {value}
        </motion.span>
      </AnimatePresence>
    </span>
  )
}

function Group({
  value,
  unit,
  scale,
  animationSpeed,
  reduced,
  dim,
}: {
  value: string
  unit: string
  scale: DigitScale
  animationSpeed: number
  reduced: boolean
  /**
   * Whether this group is a leading zero.
   *
   * Muted rather than hidden. A readout that dropped its hours would change
   * width the moment a timer crossed an hour, and the digits are centred in the
   * card — so the whole thing would shift sideways under the cursor. Dimming
   * says "this part is not carrying anything" and costs no layout at all.
   */
  dim: boolean
}) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'flex-end',
        color: dim ? color.text.muted : color.text.primary,
        transition: 'color 260ms ease',
      }}
    >
      <span style={{ display: 'inline-flex', lineHeight: 1 }}>
        {value.split('').map((digit, index) => (
          <Digit
            // Position, not value: the key that changes is the glyph's own,
            // one level down. A key on the digit here would remount the column
            // whenever its contents changed, which is the opposite of the point.
            key={index}
            value={digit}
            scale={scale}
            animationSpeed={animationSpeed}
            reduced={reduced}
          />
        ))}
      </span>
      <span
        aria-hidden
        style={{
          fontSize: scale.unit,
          fontWeight: 500,
          lineHeight: 1,
          // Sits on the numerals' baseline rather than below it. The numerals
          // are line-height 1, so their box bottom *is* the baseline and a
          // subscript would hang into the card's padding.
          paddingBottom: Math.round(scale.size * 0.08),
          marginLeft: Math.round(scale.size * 0.02),
          color: color.text.muted,
        }}
      >
        {unit}
      </span>
    </span>
  )
}

export default function RollingDigits({
  hours,
  minutes,
  seconds,
  scale,
  animationSpeed,
  reduced,
  label,
}: {
  hours: string
  minutes: string
  seconds: string
  scale: DigitScale
  animationSpeed: number
  /** `prefers-reduced-motion`, resolved by the card. */
  reduced: boolean
  /** What the readout says, for a screen reader that cannot see six columns. */
  label: string
}) {
  // Dimmed left-to-right and only while still zero, so a 90-second timer reads
  // its minutes at full strength and its hours faint, and the hours brighten the
  // moment a duration is typed that uses them.
  const hoursDim = hours === '00'
  const minutesDim = hoursDim && minutes === '00'

  return (
    <div
      role="timer"
      aria-label={label}
      style={{
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        gap: scale.gap,
        fontFamily: font.display,
        fontSize: scale.size,
        fontWeight: 500,
        lineHeight: 1,
        // Rubik's default figures are proportional; the tabular set is what keeps
        // a column's box honest as its glyph changes. Belt and braces with the
        // fixed-width columns above, which is deliberate — the fixed box stops the
        // *layout* moving and this stops the glyph sliding inside it.
        fontVariantNumeric: 'tabular-nums',
        letterSpacing: '-.02em',
      }}
    >
      <Group
        value={hours}
        unit="h"
        scale={scale}
        animationSpeed={animationSpeed}
        reduced={reduced}
        dim={hoursDim}
      />
      <Group
        value={minutes}
        unit="m"
        scale={scale}
        animationSpeed={animationSpeed}
        reduced={reduced}
        dim={minutesDim}
      />
      <Group
        value={seconds}
        unit="s"
        scale={scale}
        animationSpeed={animationSpeed}
        reduced={reduced}
        dim={false}
      />
    </div>
  )
}
