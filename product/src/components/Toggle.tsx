import { motion } from 'framer-motion'
import { color, radius, spring } from '../tokens'

/**
 * Switch — track plus knob, in the two sizes the app uses.
 *
 * Deliberately a `<span>` rather than a `<button>`: every caller wraps it in a row
 * button that owns the whole hit target, and a nested button is invalid HTML that
 * WebView2 resolves by dropping the outer one's click.
 */

const SIZES = {
  /** Tray rows — sized so adding a switch does not change the 34px row height. */
  sm: { width: 28, height: 16, knob: 12 },
  /** Settings rows, which are taller and can afford the larger target. */
  md: { width: 36, height: 20, knob: 16 },
} as const

export default function Toggle({ on, size = 'sm' }: { on: boolean; size?: keyof typeof SIZES }) {
  const { width, height, knob } = SIZES[size]

  return (
    <span
      style={{
        flex: 'none',
        width,
        height,
        borderRadius: radius.pill,
        padding: (height - knob) / 2,
        display: 'flex',
        justifyContent: on ? 'flex-end' : 'flex-start',
        background: on ? color.accent : color.inset,
        // The off state reads as a recessed well; the on state is a filled pill.
        boxShadow: on ? undefined : color.insetShadow,
        transition: 'background 120ms linear',
      }}
    >
      <motion.span
        layout
        transition={spring.peek}
        style={{
          width: knob,
          height: knob,
          borderRadius: radius.pill,
          // On, the knob sits on the accent fill and takes the colour drawn on
          // it; off, it sits in the recessed well and takes the muted type
          // colour. A hardcoded white was one of those two by coincidence.
          background: on ? color.onAccent : color.text.muted,
        }}
      />
    </span>
  )
}
