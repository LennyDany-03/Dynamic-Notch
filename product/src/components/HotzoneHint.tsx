import { motion } from 'framer-motion'
import { hotzone, radius } from '../tokens'

/**
 * The mark on the top edge that says where the notch is.
 *
 * The notch is invisible until the cursor finds it, which makes "where do I put
 * my pointer" the one thing a new install cannot answer for itself. This draws
 * the trigger strip — at exactly `hotzone.width`, so what is drawn is the target
 * rather than an approximation of it — and hovering it is the ordinary hotzone
 * entry, so the hint needs no behaviour of its own.
 *
 * Deliberately small and quiet: it is on screen for as long as the notch is not,
 * so anything with presence would be a permanent stripe across the user's
 * wallpaper. It sits inside the shell's click-through canvas and takes no pointer
 * events — the cursor poll is what notices it, the DOM never does.
 *
 * Only drawn while the notch is fully away. With the pill resting on screen
 * (always-on-top) there is nothing left to point at, and a second marker below
 * the pill would just be a smudge.
 *
 * Note that with always-on-top *off* the overlay sits at normal z-order while
 * hidden (`notch_settle`), so the hint is visible over the desktop but not over a
 * maximised window. Making it topmost regardless would put a transparent
 * click-through window permanently in the topmost band, which is the thing that
 * preference exists to avoid — and which Windows weighs when deciding whether an
 * app may take exclusive fullscreen.
 */
export default function HotzoneHint() {
  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
      style={{
        position: 'absolute',
        top: 0,
        left: '50%',
        // Centred with a margin rather than `translateX(-50%)`: framer-motion
        // owns `transform` here to animate `y`, and a static one would be
        // overwritten the moment the animation starts.
        marginLeft: -hotzone.width / 2,
        width: hotzone.width,
        height: 4,
        borderRadius: `0 0 ${radius.pill}px ${radius.pill}px`,
        background: 'rgba(255,255,255,.28)',
        // Wallpapers are not all dark. The shadow is what keeps a white hairline
        // legible over a pale one without making it heavier over a dark one.
        boxShadow: '0 1px 3px rgba(0,0,0,.45)',
        pointerEvents: 'none',
      }}
    />
  )
}
