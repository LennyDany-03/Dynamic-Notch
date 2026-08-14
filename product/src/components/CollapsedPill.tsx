import BatteryBadge from './system/BatteryBadge'
import { formatClock, useClock } from '../hooks/useClock'
import type { MediaSession } from '../hooks/useMediaSession'
import type { BatteryStatus } from '../types/system'
import { color, radius } from '../tokens'

/**
 * The 264×34 collapsed pill — the notch at rest.
 *
 * Three columns, and the reason it is a grid rather than the design export's row
 * with an absolutely-centred clock: the side columns are the *same fixed width*,
 * so the clock is centred by the layout itself and neither mark can ever reach
 * it. The absolute version worked by arithmetic — the clock spanned the whole
 * pill and the marks had to be kept narrow enough not to run into it — which is
 * how a battery readout ended up a pixel from the time. Here the badge can grow
 * to the full column and nothing moves.
 *
 * The two marks are matched chips, which is what makes this read as designed
 * rather than as three things that happen to be on the same strip: same height,
 * same radius, same surface as the tiles inside the cards. Their contents are
 * deliberately unlike — the music mark is ambient and wordless, the battery is a
 * number you read — so the chip is what says they are the same *kind* of thing,
 * a status the notch is holding for you.
 *
 * The music mark used to be two signals, the equalizer here and a matching dot on
 * the right, flanking the clock for symmetry. The dot is gone: it said exactly
 * what the equalizer says, and the symmetry it bought is now the grid's job.
 */

/** Both marks share these, which is the whole of the "they belong together". */
const CHIP = { height: 20, padding: '0 8px' } as const

/**
 * Width of the two outer columns.
 *
 * Equal, so the clock lands on the pill's centre line, and wide enough for the
 * battery chip at its longest ("100%", plus a bolt) with room to spare. The
 * middle column keeps the rest — about 100px for a time that needs half of it.
 */
const COLUMN = 74

export default function CollapsedPill({
  session,
  battery,
}: {
  session: MediaSession
  battery: BatteryStatus | null
}) {
  const { media } = session
  const isPlaying = media?.isPlaying ?? false
  const now = useClock()

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'grid',
        gridTemplateColumns: `${COLUMN}px 1fr ${COLUMN}px`,
        alignItems: 'center',
        padding: '0 12px',
      }}
    >
      {/* ── Music ──────────────────────────────────────────────────────────
          Wordless on purpose: at rest the notch says *that* something is
          playing, and the title is one hover away in the card that can hold
          it. A track name here would be clipped by the third character.

          **Drawn only while audio is actually playing.** It used to be always
          there — dimmed with no session, and frozen low when paused — on the
          reasoning that a stable pill is a calm one. In use it was the opposite:
          the pill rests on screen all day for anyone with always-on-top set, so
          a permanent chip of three grey bars became a thing you stopped seeing,
          and then the *equalizer moving* stopped being news. An indicator that
          is present when there is nothing to indicate is decoration.

          Nothing takes its place. The column is fixed width, so the clock does
          not move — which is the reason the pill is a grid (see above) and the
          reason this can come and go at all. */}
      {isPlaying ? (
        <div
          className="tile"
          style={{
            justifySelf: 'start',
            display: 'flex',
            alignItems: 'flex-end',
            gap: 2.5,
            height: CHIP.height,
            padding: CHIP.padding,
            borderRadius: radius.pill,
            // As in the badge: clips the tile's top hairline to the pill's curve.
            overflow: 'hidden',
          }}
        >
          {[0, 0.2, 0.4].map((delay) => (
            <span
              key={delay}
              className="eq"
              style={{
                width: 2.5,
                height: 11,
                marginBottom: 4.5,
                borderRadius: 2,
                background: color.accentBright,
                animationDelay: `${delay}s`,
                transformOrigin: 'bottom',
              }}
            />
          ))}
        </div>
      ) : (
        <span aria-hidden />
      )}

      {/* ── The clock ──────────────────────────────────────────────────────
          The pill's content, and the only thing here set in type. */}
      <span
        style={{
          justifySelf: 'center',
          fontSize: 13,
          fontWeight: 600,
          letterSpacing: '-.01em',
          color: color.text.primary,
          whiteSpace: 'nowrap',
          // Stops the pill twitching as digits change width.
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {formatClock(now)}
      </span>

      {/* ── The charge ─────────────────────────────────────────────────────
          Its own chip, which also carries the state as a tint — see the badge.
          Nothing at all on a desktop, where the column simply stays empty and
          the clock stays where it was. */}
      <div style={{ justifySelf: 'end', display: 'flex' }}>
        <BatteryBadge battery={battery} chip={CHIP} />
      </div>
    </div>
  )
}
