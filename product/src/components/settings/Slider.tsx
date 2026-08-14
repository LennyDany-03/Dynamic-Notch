import { useCallback, useRef, useState } from 'react'
import { color, radius } from '../../tokens'

interface Props {
  value: number
  min: number
  max: number
  step: number
  /**
   * Every position the drag passes through. Called at pointer rate, so this must
   * be cheap and must not persist anything — it exists so the surface being
   * adjusted changes under the cursor.
   */
  onPreview: (value: number) => void
  /** The position the user settled on. This is the one that gets written. */
  onCommit: (value: number) => void
  label: string
}

/**
 * A value slider, in the shape the media scrub bar established: a thin track with
 * an invisible overlay carrying the real hit height.
 *
 * Preview and commit are separate on purpose. The value behind this reaches Rust,
 * a JSON file and three windows, and a drag produces one position per pointer
 * event — writing on every one of those would rewrite the preferences file dozens
 * of times per gesture. So the drag paints locally and only the release is a
 * write. Arrow keys commit directly: they are discrete, one press is one value,
 * and there is no gesture to wait for the end of.
 */
export default function Slider({ value, min, max, step, onPreview, onCommit, label }: Props) {
  const track = useRef<HTMLDivElement>(null)
  const [dragging, setDragging] = useState(false)

  const clamp = useCallback(
    (raw: number) => Math.min(max, Math.max(min, Math.round(raw / step) * step)),
    [min, max, step],
  )

  const valueFrom = useCallback(
    (clientX: number) => {
      const el = track.current
      if (!el) return value
      const rect = el.getBoundingClientRect()
      if (rect.width <= 0) return value
      const ratio = Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1)
      return clamp(min + ratio * (max - min))
    },
    [clamp, min, max, value],
  )

  const ratio = (value - min) / (max - min)
  const percent = `${ratio * 100}%`

  return (
    <div
      role="slider"
      tabIndex={0}
      aria-label={label}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-valuetext={`${value}%`}
      onKeyDown={(event) => {
        const delta =
          event.key === 'ArrowLeft' || event.key === 'ArrowDown'
            ? -step
            : event.key === 'ArrowRight' || event.key === 'ArrowUp'
              ? step
              : 0
        if (!delta) return
        event.preventDefault()
        onCommit(clamp(value + delta))
      }}
      style={{ position: 'relative', height: 20, display: 'flex', alignItems: 'center' }}
    >
      <div
        ref={track}
        style={{
          position: 'relative',
          width: '100%',
          height: 3,
          borderRadius: radius.pill,
          background: color.scrubTrack,
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            height: '100%',
            width: percent,
            borderRadius: radius.pill,
            background: color.accent,
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: percent,
            top: '50%',
            transform: `translate(-50%,-50%) scale(${dragging ? 1.15 : 1})`,
            width: 12,
            height: 12,
            borderRadius: radius.pill,
            // Rides the head of the accent fill, like the scrub bar's knob.
            background: color.onAccent,
            boxShadow: '0 1px 3px rgba(0,0,0,.5)',
            transition: 'transform 90ms ease-out',
          }}
        />
      </div>

      {/* Hit area — the visible track is 3px tall and the knob 12px. */}
      <div
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId)
          setDragging(true)
          onPreview(valueFrom(event.clientX))
        }}
        onPointerMove={(event) => {
          if (!dragging) return
          onPreview(valueFrom(event.clientX))
        }}
        onPointerUp={(event) => {
          if (!dragging) return
          event.currentTarget.releasePointerCapture(event.pointerId)
          setDragging(false)
          onCommit(valueFrom(event.clientX))
        }}
        onPointerCancel={(event) => {
          if (!dragging) return
          setDragging(false)
          // Cancel is not a choice — commit what is on screen rather than
          // leaving the preview showing a value nothing has stored.
          onCommit(valueFrom(event.clientX))
        }}
        style={{ position: 'absolute', inset: 0, cursor: 'pointer' }}
      />
    </div>
  )
}
