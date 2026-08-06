import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { color, radius, spring } from '../tokens'

const WIDTH = 148
const ROW_H = 34
/** 6px padding above and below the single row. */
const HEIGHT = ROW_H + 12
/** Kept clear of the window edge so the card's shadow is never clipped. */
const EDGE = 6

export interface MenuAnchor {
  x: number
  y: number
}

/**
 * The notch's own right-click menu.
 *
 * WebView2 otherwise serves the Chromium menu here — Back, Print, Inspect — which
 * is both off-brand and a way to navigate the overlay somewhere it cannot come
 * back from. That menu is suppressed globally in `main.tsx`; this replaces it.
 *
 * Refresh is the only entry: it is the one browser action that is genuinely
 * useful for an overlay that runs for days at a time.
 */
export default function ContextMenu({
  anchor,
  onClose,
}: {
  anchor: MenuAnchor
  onClose: () => void
}) {
  const [hovered, setHovered] = useState(false)

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    // The overlay window can lose focus without a click landing inside it.
    window.addEventListener('keydown', onKey)
    window.addEventListener('blur', onClose)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('blur', onClose)
    }
  }, [onClose])

  // The window is only as large as the notch, so an anchor near an edge would
  // otherwise push the card out of the frame entirely.
  const x = Math.min(Math.max(anchor.x, EDGE), Math.max(window.innerWidth - WIDTH - EDGE, EDGE))
  const y = Math.min(Math.max(anchor.y, EDGE), Math.max(window.innerHeight - HEIGHT - EDGE, EDGE))

  return (
    <>
      {/* Swallows the dismissing click so it cannot also hit the card beneath. */}
      <div
        onMouseDown={onClose}
        onContextMenu={(event) => {
          event.preventDefault()
          onClose()
        }}
        style={{ position: 'fixed', inset: 0, pointerEvents: 'auto' }}
      />

      <motion.div
        className="mica"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={spring.peek}
        style={{
          position: 'fixed',
          left: x,
          top: y,
          width: WIDTH,
          borderRadius: radius.tile,
          padding: '6px 0',
          pointerEvents: 'auto',
          // Grows away from the cursor, which sits at the top-left corner.
          transformOrigin: 'top left',
        }}
      >
        {/* Above .mica::before (noise) and .mica::after (hairline). */}
        <div style={{ position: 'relative', zIndex: 1 }}>
          <button
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            onClick={() => {
              onClose()
              window.location.reload()
            }}
            style={{
              width: 'calc(100% - 12px)',
              height: ROW_H,
              margin: '0 6px',
              padding: '0 8px',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              borderRadius: radius.small,
              textAlign: 'left',
              fontSize: 13,
              color: hovered ? color.text.strong : color.text.body,
              background: hovered ? color.tile : 'transparent',
              transition: 'background 90ms linear, color 90ms linear',
            }}
          >
            <svg
              viewBox="0 0 24 24"
              width={16}
              height={16}
              fill="none"
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              stroke={hovered ? color.text.strong : color.text.icon}
              style={{ flex: 'none' }}
            >
              <path d="M20 12a8 8 0 1 1-2.3-5.6" />
              <path d="M20 4v4h-4" />
            </svg>
            <span>Refresh</span>
          </button>
        </div>
      </motion.div>
    </>
  )
}
