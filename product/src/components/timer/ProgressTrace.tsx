import { useEffect, useRef, useState } from 'react'
import { color } from '../../tokens'

/**
 * The card's progress: an outline traced around the readout, filling clockwise
 * from top-centre as the timer runs down.
 *
 * **It is a rounded rectangle rather than a ring, and that is arithmetic rather
 * than taste.** The readout is about 280 wide and 70 tall; a circle behind it
 * would either be a 70px disc lost behind the middle two digits, or a 280px one
 * needing a card taller than any in the app. Traced around the content's own
 * proportions it is the same idea — a closed path that fills as time goes — at
 * the shape the content actually has. The pill's chip stays a true ring, because
 * there the content *is* round.
 *
 * **The path is written out rather than drawn as a `<rect>`**, which is the one
 * thing here that looks like more work than it needs to be. An SVG rect's path
 * begins at its top-*left* corner, so a dash offset run along it fills from the
 * corner — and a progress outline that starts anywhere but top-centre reads as
 * broken, because every dial anyone has read starts at twelve o'clock. The
 * explicit path starts where it should and no transform has to be reasoned about.
 *
 * **The sweep glides rather than steps**, and that is what buys a 1s tick.
 * `useTimer` samples the clock once a second; a linear 1s CSS transition on the
 * offset carries the stroke smoothly between two samples, so the eye sees
 * continuous motion out of a once-a-second update. A faster tick would cost a
 * wake per frame for the life of every timer and look identical.
 */

/** Stroke weight. Heavy enough to read as a drawn edge, light enough not to box the digits in. */
const STROKE = 2

/**
 * The outline, starting at top-centre and running clockwise.
 *
 * Inset by half the stroke on every side, because SVG centres a stroke on its
 * path: without it the outer half of the line falls outside the box and is
 * clipped by the card.
 */
function tracePath(width: number, height: number, radius: number): string {
  const inset = STROKE / 2
  const w = Math.max(0, width - STROKE)
  const h = Math.max(0, height - STROKE)
  // A radius larger than half the shorter side is not a rounded rectangle, it is
  // a stadium — clamped so a narrow card cannot produce a self-crossing path.
  const r = Math.max(0, Math.min(radius, w / 2, h / 2))
  const cx = inset + w / 2
  const right = inset + w
  const bottom = inset + h

  return [
    `M ${cx} ${inset}`,
    `H ${right - r}`,
    `A ${r} ${r} 0 0 1 ${right} ${inset + r}`,
    `V ${bottom - r}`,
    `A ${r} ${r} 0 0 1 ${right - r} ${bottom}`,
    `H ${inset + r}`,
    `A ${r} ${r} 0 0 1 ${inset} ${bottom - r}`,
    `V ${inset + r}`,
    `A ${r} ${r} 0 0 1 ${inset + r} ${inset}`,
    'Z',
  ].join(' ')
}

export default function ProgressTrace({
  /** How far through, 0→1. */
  progress,
  /** Whether the sweep animates to its new value, or lands on it. */
  animate,
  radius,
}: {
  progress: number
  animate: boolean
  radius: number
}) {
  const svgRef = useRef<SVGSVGElement>(null)
  const pathRef = useRef<SVGPathElement>(null)
  const [box, setBox] = useState({ width: 0, height: 0 })
  const [length, setLength] = useState(0)

  // Measured rather than passed in, and re-measured on resize: `panelScale` is a
  // preference, so this box is not a constant and can change under a mounted
  // card when the slider moves in the settings window.
  useEffect(() => {
    const node = svgRef.current
    if (!node) return

    const measure = () => {
      const rect = node.getBoundingClientRect()
      setBox({ width: rect.width, height: rect.height })
    }
    measure()

    const observer = new ResizeObserver(measure)
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  // Read off the DOM rather than derived. The perimeter of a rounded rectangle is
  // computable, but a computed one is a second opinion that can disagree with the
  // path — and the visible failure of a disagreement is a sweep that finishes
  // early or never quite closes.
  useEffect(() => {
    if (pathRef.current && box.width > 0) setLength(pathRef.current.getTotalLength())
  }, [box.width, box.height, radius])

  const clamped = Math.min(1, Math.max(0, progress))
  const d = box.width > 0 ? tracePath(box.width, box.height, radius) : ''

  return (
    <svg
      ref={svgRef}
      aria-hidden
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        // Behind the digits, and click-through: the readout under it is a real
        // target — clicking it starts editing — and an SVG on top would eat that.
        pointerEvents: 'none',
      }}
    >
      {/* The track: the whole path, always, at the weight a divider is drawn at.
          So the outline is a *shape* before any time has passed rather than an
          arc appearing out of nothing, and the fill has something to be read
          against. */}
      <path d={d} fill="none" stroke={color.dividerStrong} strokeWidth={STROKE} />

      <path
        ref={pathRef}
        d={d}
        fill="none"
        stroke={color.accent}
        strokeWidth={STROKE}
        strokeLinecap="round"
        style={{
          // Zero-length until the measure lands, so the first frame draws nothing
          // rather than a full outline snapping back to empty.
          strokeDasharray: length || 1,
          strokeDashoffset: length ? length * (1 - clamped) : 1,
          // Linear, and exactly the tick interval. Anything eased would arrive
          // early and wait, which on a repeating one-second cycle reads as a
          // stutter rather than as easing.
          transition: animate ? 'stroke-dashoffset 1s linear' : 'none',
        }}
      />
    </svg>
  )
}
