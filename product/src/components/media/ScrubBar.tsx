import { useCallback, useRef, useState } from 'react'
import { color } from '../../tokens'

interface Props {
  progressMs: number
  durationMs: number
  onSeek: (positionMs: number) => void
}

function formatTime(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return '0:00'
  const total = Math.floor(ms / 1000)
  const minutes = Math.floor(total / 60)
  const seconds = total % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

/**
 * Draggable scrub bar. The track is 2px per the design, so pointer capture is
 * handled by an invisible overlay with a real hit height.
 *
 * While dragging, the handle follows the cursor rather than the polled position —
 * otherwise the next poll would snap it back mid-gesture.
 */
export default function ScrubBar({ progressMs, durationMs, onSeek }: Props) {
  const trackRef = useRef<HTMLDivElement>(null)
  const [dragRatio, setDragRatio] = useState<number | null>(null)

  const hasDuration = durationMs > 0
  const polledRatio = hasDuration ? Math.min(progressMs / durationMs, 1) : 0
  const ratio = dragRatio ?? polledRatio

  const ratioFromEvent = useCallback((clientX: number) => {
    const el = trackRef.current
    if (!el) return 0
    const rect = el.getBoundingClientRect()
    if (rect.width <= 0) return 0
    return Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1)
  }, [])

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!hasDuration) return
    e.currentTarget.setPointerCapture(e.pointerId)
    setDragRatio(ratioFromEvent(e.clientX))
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    if (dragRatio === null) return
    setDragRatio(ratioFromEvent(e.clientX))
  }

  const handlePointerUp = (e: React.PointerEvent) => {
    if (dragRatio === null) return
    const finalRatio = ratioFromEvent(e.clientX)
    e.currentTarget.releasePointerCapture(e.pointerId)
    setDragRatio(null)
    onSeek(finalRatio * durationMs)
  }

  const displayedMs = dragRatio !== null ? dragRatio * durationMs : progressMs
  const percent = `${ratio * 100}%`

  return (
    <div style={{ marginTop: 10 }}>
      <div
        ref={trackRef}
        style={{
          position: 'relative',
          height: 2,
          borderRadius: 99,
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
            borderRadius: 99,
            background: color.accent,
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: percent,
            top: '50%',
            transform: 'translate(-50%,-50%)',
            width: 9,
            height: 9,
            borderRadius: 99,
            background: '#fff',
            boxShadow: '0 1px 3px rgba(0,0,0,.5)',
            opacity: hasDuration ? 1 : 0,
          }}
        />
        {/* Hit area — the visible track is only 2px tall. */}
        <div
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: -9,
            bottom: -9,
            cursor: hasDuration ? 'pointer' : 'default',
          }}
        />
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginTop: 5,
          fontSize: 11,
          color: color.text.muted,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        <span>{formatTime(displayedMs)}</span>
        <span>{formatTime(durationMs)}</span>
      </div>
    </div>
  )
}
