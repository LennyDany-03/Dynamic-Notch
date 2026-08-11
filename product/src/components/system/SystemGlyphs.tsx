import { motion, useReducedMotion } from 'framer-motion'
import type { ReactNode } from 'react'
import type { BatteryStatus, BluetoothKind, NetworkStatus } from '../../types/system'
import { color, radius } from '../../tokens'

/**
 * The pictures on the system banner, and the movement that makes each one say
 * what just happened.
 *
 * The animation *is* the message here, which is why these are not the flat icons
 * the rest of the app uses. A banner that reads "Plugged in" tells you something
 * you already know — you are holding the cable. What it is for is the corner of
 * your eye: a plug sliding home and a bolt landing, seen without reading, is the
 * confirmation, and the words underneath are the detail you look at only if the
 * movement was not what you expected.
 *
 * Every glyph is drawn in stroke rather than fill for one reason: a stroked path
 * can be *drawn* (`pathLength` 0 → 1), and that is what a connection looks like.
 * Adding a filled glyph here means it will simply appear while its neighbours
 * draw themselves in, so keep to strokes.
 *
 * Each of these mounts fresh per announcement — the banner is keyed on the
 * event's id — so there is no exit animation to play and none is needed: the
 * "off" states animate *to* their resting position from the state they were in,
 * which is what makes an unplug read as something being taken away rather than
 * as a second, unrelated picture.
 */

/** Every glyph shares one 24px box and one stroke weight. */
const BOX = 24

const stroke = {
  fill: 'none',
  strokeWidth: 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

/** Live: the accent, used for arrivals. Gone: the same grey as an idle row icon. */
const tone = { on: color.accent, off: color.text.icon } as const

/**
 * A stroke that draws itself on, unless the user has asked for less movement —
 * in which case it is simply there, which is the same picture without the 400ms.
 */
function Draw({
  d,
  delay = 0,
  duration = 0.4,
  still,
}: {
  d: string
  delay?: number
  duration?: number
  /** The reduced-motion answer, resolved by the caller so one hook covers a glyph. */
  still: boolean
}) {
  return (
    <motion.path
      d={d}
      initial={still ? false : { pathLength: 0, opacity: 0 }}
      animate={{ pathLength: 1, opacity: 1 }}
      transition={{ duration, delay, ease: 'easeOut' }}
    />
  )
}

/**
 * The 44px tile the glyph sits in, matching the album art on the media banner so
 * the three announcements read as one surface.
 *
 * `ping` sends a ring out from the tile — the "something connected" mark. Two of
 * them, staggered, because one ring reads as a stray highlight and three reads as
 * an alarm. Nothing is drawn for a disconnection: a loss is the absence of that,
 * and inventing a movement for it would give the two events equal weight.
 */
export function GlyphTile({
  children,
  ping,
  live,
}: {
  children: ReactNode
  ping: boolean
  live: boolean
}) {
  const still = useReducedMotion() ?? false

  return (
    <div style={{ position: 'relative', width: 44, height: 44, flex: 'none' }}>
      {ping &&
        !still &&
        [0, 0.28].map((delay) => (
          <motion.span
            key={delay}
            initial={{ scale: 0.85, opacity: 0.45 }}
            animate={{ scale: 1.5, opacity: 0 }}
            transition={{ duration: 0.9, delay, ease: 'easeOut' }}
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: radius.small,
              border: `1px solid ${color.accent}`,
              pointerEvents: 'none',
            }}
          />
        ))}

      <div
        className="tile"
        style={{
          width: '100%',
          height: '100%',
          display: 'grid',
          placeItems: 'center',
          // The accent wash is what carries the state at a glance, before any of
          // the type is read. It is deliberately faint: this is a report, and a
          // saturated tile in the corner of the eye reads as an error.
          background: live ? 'rgba(124,58,237,.18)' : color.tile,
          color: live ? tone.on : tone.off,
        }}
      >
        {children}
      </div>
    </div>
  )
}

function Svg({ children }: { children: ReactNode }) {
  return (
    <svg viewBox={`0 0 ${BOX} ${BOX}`} width={22} height={22} {...stroke} stroke="currentColor">
      {children}
    </svg>
  )
}

/**
 * The bar across a glyph that says the thing is gone.
 *
 * Drawn *after* the glyph it crosses (`delay`), so the eye reads the device
 * first and the loss second — struck through in the order it happened.
 */
function Slash({ still }: { still: boolean }) {
  return <Draw d="M5 19L19 5" still={still} delay={0.18} duration={0.28} />
}

/**
 * The charger going in or coming out.
 *
 * Three things move and each is one half of the sentence: the plug slides into
 * the battery (or is pulled out of it), the fill runs to the charge Windows
 * reports, and the bolt lands on top of it. The fill is the reason this is not
 * simply a bolt appearing — an unplug has no bolt to show, and without the level
 * settling to where it now stands there would be nothing at all to look at.
 */
export function PowerGlyph({ battery, plugged }: { battery: BatteryStatus; plugged: boolean }) {
  const still = useReducedMotion() ?? false

  // The fill is drawn at full width and scaled, rather than having its `width`
  // animated: `width` on an SVG rect is a geometry attribute, and scaling is one
  // compositor property either way. The origin is the battery's left terminal, so
  // it grows out of the contact rather than out of its own middle.
  const level = Math.max(0, Math.min(100, battery.percent ?? 0)) / 100

  return (
    <GlyphTile ping={plugged} live={plugged}>
      <Svg>
        <rect x="2" y="7.5" width="17" height="9" rx="2.5" />

        {/* The cap doubles as the plug: in from the right on a connection, out
            the same way on a disconnection. It is the only part of the picture
            that moves the way the user's hand just did. */}
        <motion.path
          d="M21 10.5v3"
          strokeWidth={2}
          initial={still ? false : plugged ? { x: 6, opacity: 0 } : { x: 0, opacity: 1 }}
          animate={plugged ? { x: 0, opacity: 1 } : { x: 7, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 420, damping: 26, delay: plugged ? 0 : 0.1 }}
        />

        {/* Charge. Runs out from the terminal rather than fading in, so the
            length of it is legible without reading the percentage. Left out
            entirely when Windows will not give a figure — an empty battery is a
            worse answer than no answer. */}
        {battery.percent !== null && (
          <motion.rect
            x="4"
            y="9.5"
            width="13"
            height="5"
            rx="1.5"
            stroke="none"
            fill="currentColor"
            initial={still ? false : { scaleX: plugged ? 0 : 1 }}
            animate={{ scaleX: level }}
            transition={{ type: 'spring', stiffness: 260, damping: 30, delay: 0.05 }}
            style={{ opacity: 0.9, transformOrigin: '4px 12px' }}
          />
        )}

        {/* The bolt only exists while the charger does: it springs in over the
            fill on a plug, and is taken away first on an unplug. */}
        <motion.path
          d="M12.9 8.1L9.2 12.6h2.4l-.6 3.4 3.8-4.6h-2.5z"
          stroke="none"
          fill={plugged ? '#fff' : 'currentColor'}
          initial={still ? false : plugged ? { scale: 0, opacity: 0, rotate: -35 } : { scale: 1, opacity: 1 }}
          animate={plugged ? { scale: 1, opacity: 1, rotate: 0 } : { scale: 0.4, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 500, damping: 20, delay: plugged ? 0.12 : 0 }}
          style={{ transformOrigin: '12px 12px' }}
        />
      </Svg>
    </GlyphTile>
  )
}

/**
 * What a connected Bluetooth device is, drawn as the thing itself.
 *
 * A headset that connects draws a headset. The class of device is already in the
 * snapshot (`system.rs` reads it once per device and caches it), and a picture of
 * the object is recognised before a name is read — which is the whole job of a
 * surface that is on screen for three seconds.
 */
function deviceGlyph(kind: BluetoothKind, still: boolean) {
  switch (kind) {
    case 'audio':
      return (
        <>
          <Draw d="M5 14v-1.6a7 7 0 0 1 14 0V14" still={still} />
          <Draw d="M3.6 14.5A1.5 1.5 0 0 1 5.1 13H7v6H5.1a1.5 1.5 0 0 1-1.5-1.5z" still={still} delay={0.1} />
          <Draw d="M20.4 14.5A1.5 1.5 0 0 0 18.9 13H17v6h1.9a1.5 1.5 0 0 0 1.5-1.5z" still={still} delay={0.1} />
        </>
      )
    case 'phone':
      return (
        <>
          <Draw d="M7.5 5.5a2.5 2.5 0 0 1 2.5-2.5h4a2.5 2.5 0 0 1 2.5 2.5v13a2.5 2.5 0 0 1-2.5 2.5h-4A2.5 2.5 0 0 1 7.5 18.5z" still={still} />
          <Draw d="M10.75 17.5h2.5" still={still} delay={0.22} />
        </>
      )
    case 'computer':
      return (
        <>
          <Draw d="M4.5 7a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v8h-15z" still={still} />
          <Draw d="M2.5 18.5h19" still={still} delay={0.22} />
        </>
      )
    case 'peripheral':
      return (
        <>
          <Draw d="M7.5 8a4.5 4.5 0 0 1 9 0v8a4.5 4.5 0 0 1-9 0z" still={still} />
          <Draw d="M12 7.5v3" still={still} delay={0.22} />
        </>
      )
    case 'wearable':
      return (
        <>
          <Draw d="M7.5 10a3 3 0 0 1 3-3h3a3 3 0 0 1 3 3v4a3 3 0 0 1-3 3h-3a3 3 0 0 1-3-3z" still={still} />
          <Draw d="M9.75 7V4h4.5v3" still={still} delay={0.18} />
          <Draw d="M9.75 17v3h4.5v-3" still={still} delay={0.18} />
        </>
      )
    default:
      // The rune. Nothing is known about the device beyond its being Bluetooth —
      // Bluetooth LE carries no class of device — so the radio is the honest
      // picture rather than a guess at what the thing is.
      return <Draw d="M7 7.4L16.4 16.6 11.7 21.3V2.7l4.7 4.7L7 16.6" still={still} duration={0.5} />
  }
}

export function BluetoothGlyph({ kind, connected }: { kind: BluetoothKind; connected: boolean }) {
  const still = useReducedMotion() ?? false

  return (
    <GlyphTile ping={connected} live={connected}>
      <Svg>
        {deviceGlyph(kind, still)}
        {!connected && <Slash still={still} />}
      </Svg>
    </GlyphTile>
  )
}

/**
 * The network, drawn as its strength.
 *
 * The arcs come in from the dot outward, which is the shape of a connection
 * being made, and only as many of them as the signal actually justifies: a
 * banner that always drew three bars would be announcing a connection it has not
 * checked. The unlit arcs stay on at a low opacity rather than being left out —
 * a two-bar connection is legible as two *of three*, and three arcs that shrink
 * to two between polls would look like the picture changing its mind.
 */
export function NetworkGlyph({ network, connected }: { network: NetworkStatus; connected: boolean }) {
  const still = useReducedMotion() ?? false

  // Anything that is not a live Wi-Fi connection: a dock or an ethernet cable,
  // and every disconnection — the snapshot has no network left to describe once
  // the connection is gone, so a struck-through globe is all there is to draw.
  if (!connected || network.kind !== 'wifi') {
    return (
      <GlyphTile ping={connected} live={connected}>
        <Svg>
          <Draw d="M12 3.5a8.5 8.5 0 1 1 0 17 8.5 8.5 0 0 1 0-17z" still={still} />
          <Draw d="M3.5 12h17" still={still} delay={0.12} />
          <Draw d="M12 3.5a13 13 0 0 1 0 17 13 13 0 0 1 0-17z" still={still} delay={0.2} />
          {!connected && <Slash still={still} />}
        </Svg>
      </GlyphTile>
    )
  }

  // 0–5 bars from Windows, three arcs to spend them on. No reading at all is
  // drawn as full: the connection is real, and an arbitrary "one bar" would be a
  // worse guess than none.
  const bars = network.signalBars === null ? 3 : Math.ceil((network.signalBars / 5) * 3)

  const arcs = [
    { d: 'M4.6 9.4a11.5 11.5 0 0 1 14.8 0', delay: 0.22 },
    { d: 'M7.6 13a7.2 7.2 0 0 1 8.8 0', delay: 0.12 },
    { d: 'M10.4 16.5a3.2 3.2 0 0 1 3.2 0', delay: 0.02 },
  ]

  return (
    <GlyphTile ping live>
      <Svg>
        {arcs.map((arc, index) => {
          // Index 0 is the outer arc, so a two-bar reading lights the two inner
          // ones — the same order the arcs are drawn in.
          const lit = 3 - index <= bars
          return (
            <motion.path
              key={arc.d}
              d={arc.d}
              initial={still ? false : { pathLength: 0, opacity: 0, scale: 0.7 }}
              animate={{ pathLength: 1, opacity: lit ? 1 : 0.25, scale: 1 }}
              transition={{ duration: 0.32, delay: arc.delay, ease: 'easeOut' }}
              style={{ transformOrigin: '12px 19px' }}
            />
          )
        })}

        <motion.circle
          cx="12"
          cy="19"
          r="1.2"
          stroke="none"
          fill="currentColor"
          initial={still ? false : { scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 600, damping: 22 }}
          style={{ transformOrigin: '12px 19px' }}
        />
      </Svg>
    </GlyphTile>
  )
}
