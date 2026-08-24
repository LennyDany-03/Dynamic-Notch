import { motion, useReducedMotion } from 'framer-motion'
import { GlyphTile } from '../system/SystemGlyphs'
import { color } from '../../tokens'
import { describeDuration } from '../../types/timer'

/**
 * A countdown has landed — on the same banner every other announcement uses.
 *
 * Like the reminder, this is an announcement the user asked for, so the three
 * lines have nothing to explain: they already know what the timer was for,
 * because they set it. What the banner has to do is be unmissable and say which
 * timer, which at one timer is the same as saying how long it ran.
 *
 * Dwells through to the timer card, which by the time this is on screen is
 * already back at rest showing that same duration — so the useful thing to do
 * about a finished timer, running it again, is one hover and one click away.
 */

/** An hourglass, drawn with the same stroke set as `SystemGlyphs`. */
function HourglassGlyph() {
  const still = useReducedMotion() ?? false

  return (
    <GlyphTile ping live>
      <svg
        viewBox="0 0 24 24"
        width={22}
        height={22}
        fill="none"
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
        stroke="currentColor"
      >
        {/* The one glyph in the app that is a *completion*, and an hourglass is
            already the picture everyone has for it. It turns rather than draws
            itself in, for the reason the bell rocks: the movement is the message.
            A half-turn, once — a glass that kept spinning would say the timer had
            started rather than finished. */}
        <motion.g
          initial={still ? false : { rotate: 0 }}
          animate={still ? undefined : { rotate: 180 }}
          transition={{ duration: 0.62, ease: [0.22, 1, 0.36, 1] }}
          style={{ transformOrigin: '12px 12px' }}
        >
          <path d="M6.5 3h11M6.5 21h11" />
          <path d="M8 3v3.2c0 1.4 4 3.9 4 5.8 0-1.9 4-4.4 4-5.8V3" />
          <path d="M8 21v-3.2c0-1.4 4-3.9 4-5.8 0 1.9 4 4.4 4 5.8V21" />
        </motion.g>

        {/* The last grain, falling as the glass turns. Small enough to read as a
            detail rather than as a second object, and it is what stops the turn
            looking like a rotating icon. */}
        {!still && (
          <motion.circle
            cx="12"
            cy="12"
            r="0.9"
            fill="currentColor"
            stroke="none"
            initial={{ y: -1, opacity: 0 }}
            animate={{ y: [-1, 5], opacity: [0, 1, 0] }}
            transition={{ duration: 0.5, delay: 0.5, ease: 'easeIn' }}
          />
        )}
      </svg>
    </GlyphTile>
  )
}

export default function TimerAnnounce({ durationMs }: { durationMs: number }) {
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
      <HourglassGlyph />

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
          Timer
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
          Time&apos;s up
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
          {/* Which timer, at one timer. Spelled out rather than shown as digits
              because this line is prose and `05:30:00` in the middle of a
              sentence reads as a stopwatch reading rather than as a length. */}
          {describeDuration(durationMs)} · hover to set another
        </div>
      </div>
    </div>
  )
}
