import { motion, useReducedMotion } from 'framer-motion'
import { GlyphTile } from '../system/SystemGlyphs'
import { color, radius } from '../../tokens'
import type { UpdatePhase, UpdateProgress } from '../../hooks/useAutoUpdate'

/**
 * Crest updating itself, on the same banner every other announcement uses.
 *
 * This is the whole of the update UI. NSIS runs with `installMode: "quiet"`, so
 * there is no setup window, no progress dialog and no "installation complete"
 * page — an app that updates itself should not hand the user somebody else's
 * installer, and the notch is already the place this app says things.
 *
 * Two things carry the state, and they are deliberately different channels. The
 * **ring** around the glyph fills as the download does, so the progress is legible
 * from the corner of an eye without reading a number; the **line under the text**
 * is the same figure in the shape a progress bar is expected to be. Between them
 * a glance answers "is this moving" and a look answers "how far".
 *
 * The byte counts are on the third line rather than a bare percentage, because a
 * bar that has not visibly moved for three seconds is indistinguishable from a
 * stalled one — "1.2 of 48 MB" says it is a big update, not a stuck one.
 */

/** The ring. Circumference is what `strokeDashoffset` animates against. */
const R = 15.5
const CIRCUMFERENCE = 2 * Math.PI * R

/** MB to one decimal, which is the precision a download is legible at. */
function megabytes(bytes: number): string {
  return `${(bytes / 1_000_000).toFixed(1)} MB`
}

function detailFor(phase: UpdatePhase, progress: UpdateProgress | null): string {
  if (phase === 'installing') return 'Restarting in a moment'
  if (!progress) return 'Starting the download…'
  if (progress.total === null) {
    // No content-length. The percentage would be a fabrication, so the bytes
    // that *are* known are the honest thing to show.
    return `${megabytes(progress.downloaded)} downloaded`
  }
  return `${megabytes(progress.downloaded)} of ${megabytes(progress.total)}`
}

export default function UpdateAnnounce({
  phase,
  version,
  progress,
}: {
  phase: UpdatePhase
  version: string | null
  progress: UpdateProgress | null
}) {
  const still = useReducedMotion() ?? false

  // Installing is the moment after the last byte, so the ring is full for it
  // rather than dropping back to whatever the download ended on.
  const percent = phase === 'installing' ? 100 : (progress?.percent ?? null)
  const indeterminate = percent === null

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        padding: '0 14px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        color: color.text.strong,
      }}
    >
      <GlyphTile ping={false} live>
        <svg viewBox="0 0 40 40" width={34} height={34} fill="none">
          {/* The unspent ring, so the arc is read against something. */}
          <circle cx="20" cy="20" r={R} stroke="currentColor" strokeWidth={2.4} opacity={0.18} />

          {indeterminate ? (
            // A quarter-arc that simply spins. Nothing here knows how far along
            // the download is, and a bar creeping forward on no information
            // would be inventing progress.
            <motion.circle
              cx="20"
              cy="20"
              r={R}
              stroke="currentColor"
              strokeWidth={2.4}
              strokeLinecap="round"
              strokeDasharray={`${CIRCUMFERENCE * 0.25} ${CIRCUMFERENCE}`}
              animate={still ? undefined : { rotate: 360 }}
              transition={{ duration: 1.1, ease: 'linear', repeat: Infinity }}
              style={{ transformOrigin: '20px 20px' }}
            />
          ) : (
            <motion.circle
              cx="20"
              cy="20"
              r={R}
              stroke="currentColor"
              strokeWidth={2.4}
              strokeLinecap="round"
              strokeDasharray={CIRCUMFERENCE}
              initial={false}
              animate={{ strokeDashoffset: CIRCUMFERENCE * (1 - percent / 100) }}
              transition={{ type: 'spring', stiffness: 120, damping: 24 }}
              // Twelve o'clock, clockwise — the direction every progress ring
              // anyone has seen goes.
              style={{ transformOrigin: '20px 20px', rotate: -90 }}
            />
          )}

          {/* A download arrow, nudged down and back on a loop. The ring says how
              far; this says what kind of thing is happening. */}
          <motion.g
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            animate={still || phase === 'installing' ? undefined : { y: [0, 2, 0] }}
            transition={{ duration: 1.4, ease: 'easeInOut', repeat: Infinity }}
          >
            <path d="M20 14v9" />
            <path d="M16.4 19.6L20 23.2l3.6-3.6" />
          </motion.g>
        </svg>
      </GlyphTile>

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
          {phase === 'installing' ? 'Installing' : 'Updating Crest'}
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
          {version ? `Version ${version}` : 'Downloading the update'}
          {!indeterminate && (
            <span
              style={{
                marginLeft: 8,
                fontWeight: 500,
                fontVariantNumeric: 'tabular-nums',
                color: color.text.secondary,
              }}
            >
              {percent}%
            </span>
          )}
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
          {detailFor(phase, progress)}
        </div>
      </div>

      {/* The bar. Along the very bottom edge of the banner, inset to the card's
          radius so it does not poke out of the rounded corners. */}
      <div
        style={{
          position: 'absolute',
          left: 12,
          right: 12,
          bottom: 6,
          height: 2,
          borderRadius: radius.pill,
          background: color.scrubTrack,
          overflow: 'hidden',
        }}
      >
        <motion.div
          initial={false}
          animate={
            indeterminate
              ? // Sweeps across rather than filling: with no total there is no
                // "how far", only "still going".
                { x: ['-100%', '100%'] }
              : { scaleX: percent / 100 }
          }
          transition={
            indeterminate
              ? { duration: 1.2, ease: 'easeInOut', repeat: Infinity }
              : { type: 'spring', stiffness: 120, damping: 24 }
          }
          style={{
            width: indeterminate ? '45%' : '100%',
            height: '100%',
            borderRadius: radius.pill,
            background: color.accent,
            transformOrigin: 'left center',
          }}
        />
      </div>
    </div>
  )
}
