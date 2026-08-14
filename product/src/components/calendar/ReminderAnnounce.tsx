import { motion, useReducedMotion } from 'framer-motion'
import { GlyphTile } from '../system/SystemGlyphs'
import { color } from '../../tokens'
import { formatTime, type Reminder } from '../../types/reminders'

/**
 * A reminder has come due — on the same banner every other announcement uses.
 *
 * The one announcement the *user themselves* asked for, which changes what the
 * three lines have to carry. A notification has to say who it is from, and a
 * charger has to say what happened, because in both cases the news is the event.
 * Here the user already knows the event: they typed it. So the middle line is
 * their own words, verbatim and unabbreviated as far as 300px allows, and the
 * lines around it are only enough to place them — the time it was set for, and
 * how late it is by now.
 *
 * Dwells through to the calendar (see `useNotchState`), because the useful thing
 * to do about a reminder is usually to tick it off or look at what else is on
 * that day, and both are there.
 */

/** A bell, drawn with the same stroke set as `SystemGlyphs`. */
function BellGlyph() {
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
        {/* The bell rocks rather than draws itself in. This is the one glyph in
            the app that is a *sound* — the movement of a bell being rung is the
            picture everyone already has, and drawing its outline would be a
            picture of a bell rather than of ringing. */}
        <motion.g
          initial={still ? false : { rotate: 0 }}
          animate={still ? undefined : { rotate: [0, -13, 11, -7, 4, 0] }}
          transition={{ duration: 0.75, ease: 'easeOut', times: [0, 0.14, 0.34, 0.56, 0.78, 1] }}
          style={{ transformOrigin: '12px 5px' }}
        >
          <path d="M18 9.5a6 6 0 1 0-12 0c0 5-2 6.5-2 6.5h16s-2-1.5-2-6.5" />
          <path d="M12 2.5v1.6" />
        </motion.g>

        {/* The clapper swings a beat behind the bell, which is what makes the
            rock read as ringing rather than as the whole glyph wobbling. */}
        <motion.path
          d="M13.9 19.2a2.2 2.2 0 0 1-3.8 0"
          initial={still ? false : { rotate: 0 }}
          animate={still ? undefined : { rotate: [0, -16, 13, -8, 0] }}
          transition={{ duration: 0.8, delay: 0.06, ease: 'easeOut' }}
          style={{ transformOrigin: '12px 16px' }}
        />
      </svg>
    </GlyphTile>
  )
}

export default function ReminderAnnounce({ reminder }: { reminder: Reminder }) {
  // Rounded to the minute. A reminder that fires within twenty seconds of its
  // time (see `useReminders`) saying "1 minute late" would be pedantry about the
  // app's own tick rate.
  const lateMinutes = Math.round((Date.now() - reminder.dueAt) / 60_000)

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
      <BellGlyph />

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
          Reminder
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
          {reminder.title}
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
          {formatTime(reminder.dueAt)}
          {/* Only said when it is true and worth saying. A reminder caught after
              a sleeping laptop wakes is genuinely hours late, and letting it
              claim to be on time would be the app covering for itself. */}
          {lateMinutes >= 2 &&
            ` · ${lateMinutes < 60 ? `${lateMinutes} min` : `${Math.round(lateMinutes / 60)} hr`} ago`}
        </div>
      </div>
    </div>
  )
}
