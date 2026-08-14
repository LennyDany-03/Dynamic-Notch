import { useEffect, useMemo, useRef, useState } from 'react'
import { Reorder, useDragControls } from 'framer-motion'
import Toggle from '../Toggle'
import { color, radius } from '../../tokens'
import {
  MODULE_LABELS,
  MODULES,
  resolvePanels,
  type NotchModule,
  type PanelPref,
} from '../../types/notch'

/**
 * Which cards the notch offers, and in what order.
 *
 * The nav arrows are the only way to move between cards, so their sequence *is*
 * the app's information architecture — and until now it was a literal in
 * `types/notch.ts` that suited whoever added the last module. Seven cards is also
 * past the point where a ring is comfortable to walk: someone who wants the media
 * controls and the clipboard has to pass the weather to get there.
 *
 * So: a tick to take a card out of the ring, and a drag to move it. Both write
 * the same ordered list, because they are the same preference — "what the notch
 * offers" — asked two ways.
 *
 * **Reordering is `framer-motion`'s `Reorder`**, which is already a dependency
 * and is the reason this is forty lines rather than a drag-and-drop
 * implementation. It also animates the displacement, which matters more than it
 * sounds: a list that reorders instantly on drop leaves you checking whether the
 * thing you moved went where you meant, and the 200ms of travel answers that
 * without a second glance.
 *
 * **The drag handle is explicit** (`useDragControls` rather than a draggable
 * row). Rows carry a switch, and a row that is draggable everywhere makes every
 * slightly-imprecise tap on that switch into a two-pixel drag that swallows the
 * click.
 */

/** Row height, fixed so the drag animation has something stable to move. */
const ROW_H = 44

function Handle({ onPointerDown }: { onPointerDown: (event: React.PointerEvent) => void }) {
  const [hovered, setHovered] = useState(false)

  return (
    <span
      onPointerDown={onPointerDown}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      role="button"
      aria-label="Drag to reorder"
      title="Drag to reorder"
      style={{
        width: 20,
        height: 24,
        flex: 'none',
        display: 'grid',
        placeItems: 'center',
        cursor: 'grab',
        touchAction: 'none',
        color: hovered ? color.text.secondary : color.text.muted,
        transition: 'color 90ms linear',
      }}
    >
      <svg viewBox="0 0 24 24" width={14} height={14} fill="currentColor">
        {[8, 12, 16].map((y) =>
          [9, 15].map((x) => <circle key={`${x}-${y}`} cx={x} cy={y} r="1.4" />),
        )}
      </svg>
    </span>
  )
}

function PanelRow({
  panel,
  position,
  /** False when this is the last one switched on — see `toggle` below. */
  canHide,
  onToggle,
  onDragStart,
  onDragEnd,
}: {
  panel: { id: NotchModule; visible: boolean }
  position: number | null
  canHide: boolean
  onToggle: () => void
  onDragStart: () => void
  onDragEnd: () => void
}) {
  const controls = useDragControls()
  const [hovered, setHovered] = useState(false)

  return (
    <Reorder.Item
      value={panel}
      dragListener={false}
      dragControls={controls}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      style={{ listStyle: 'none' }}
      // Lifted while dragging, so the row being moved reads as above the ones it
      // is displacing rather than as part of the list it is pushing through.
      whileDrag={{ scale: 1.02, zIndex: 2 }}
    >
      <div
        onPointerEnter={() => setHovered(true)}
        onPointerLeave={() => setHovered(false)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          height: ROW_H,
          padding: '0 10px',
          borderRadius: radius.tile,
          background: hovered ? color.tile : 'transparent',
          transition: 'background 90ms linear',
        }}
      >
        <Handle onPointerDown={(event) => controls.start(event)} />

        {/* The position, which is the whole point of the list: this is the number
            the nav strip shows as "2/5". Hidden cards get a dash rather than a
            number, because they have no position — they are not in the ring. */}
        <span
          style={{
            width: 18,
            flex: 'none',
            textAlign: 'center',
            fontSize: 11,
            fontWeight: 600,
            fontVariantNumeric: 'tabular-nums',
            color: position === null ? color.text.muted : color.accent,
          }}
        >
          {position ?? '—'}
        </span>

        <span
          style={{
            flex: 1,
            minWidth: 0,
            fontSize: 13,
            color: panel.visible ? color.text.primary : color.text.muted,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {MODULE_LABELS[panel.id]}
        </span>

        <button
          type="button"
          role="switch"
          aria-checked={panel.visible}
          aria-label={`Show ${MODULE_LABELS[panel.id]} in the notch`}
          onClick={() => {
            if (canHide || !panel.visible) onToggle()
          }}
          title={
            canHide || !panel.visible
              ? panel.visible
                ? 'Take this out of the notch'
                : 'Put this back in the notch'
              : 'The notch needs at least one panel'
          }
          style={{
            flex: 'none',
            padding: 0,
            display: 'flex',
            // Dimmed rather than hidden when it is the last one on: the switch
            // still describes the state, it just cannot be moved.
            opacity: canHide || !panel.visible ? 1 : 0.45,
            cursor: canHide || !panel.visible ? 'pointer' : 'default',
          }}
        >
          <Toggle on={panel.visible} />
        </button>
      </div>
    </Reorder.Item>
  )
}

export default function PanelOrder({
  stored,
  onChange,
}: {
  stored: PanelPref[]
  onChange: (panels: PanelPref[]) => void
}) {
  // Resolved rather than rendered raw, so a fresh install (empty preference) and
  // a version that has just gained a card both show the full list. The write
  // below stores the resolved form, which is how the preference becomes concrete
  // the first time it is touched.
  const resolved = useMemo(() => resolvePanels(stored).all, [stored])

  /**
   * The list actually rendered, held locally while a drag is in flight.
   *
   * `Reorder` calls `onReorder` on every swap *during* the gesture, not on drop.
   * Writing each of those straight through would send a command to Rust per
   * swapped row, and — the part that actually breaks — the broadcast comes back
   * with a freshly-parsed array, so every `Reorder.Item`'s `value` identity
   * changes underneath the drag that is still happening. Framer matches items by
   * that identity, so the gesture drops on the spot.
   *
   * So the drag moves local state and the write happens once, on release.
   */
  const [draft, setDraft] = useState(resolved)
  const dragging = useRef(false)
  const draftRef = useRef(draft)
  draftRef.current = draft

  // Adopt the stored value whenever it changes from elsewhere — a toggle, a
  // Reset, another window — but never mid-gesture, which would be the same
  // identity swap by a different route.
  useEffect(() => {
    if (!dragging.current) setDraft(resolved)
  }, [resolved])

  const panels = draft
  const visibleCount = panels.filter((panel) => panel.visible).length

  /** Positions run over the visible ones only — they are the ring. */
  const positions = useMemo(() => {
    const map = new Map<NotchModule, number>()
    let next = 1
    for (const panel of panels) if (panel.visible) map.set(panel.id, next++)
    return map
  }, [panels])

  const commit = (next: { id: NotchModule; visible: boolean }[]) =>
    onChange(next.map(({ id, visible }) => ({ id, visible })))

  const toggle = (id: NotchModule) =>
    commit(
      panels.map((panel) => (panel.id === id ? { ...panel, visible: !panel.visible } : panel)),
    )

  const reset = () => commit(MODULES.map((id) => ({ id, visible: true })))

  const isDefault =
    panels.length === MODULES.length &&
    panels.every((panel, index) => panel.visible && panel.id === MODULES[index])

  return (
    <div style={{ padding: '0 2px' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: 8,
          margin: '0 10px 8px',
        }}
      >
        <span style={{ fontSize: 12, color: color.text.muted }}>
          {visibleCount} of {MODULES.length} in the notch
        </span>

        <span style={{ flex: 1 }} />

        {!isDefault && (
          <button
            type="button"
            onClick={reset}
            style={{
              height: 22,
              padding: '0 9px',
              borderRadius: radius.small,
              fontSize: 11.5,
              color: color.text.secondary,
              background: color.tile,
            }}
          >
            Reset
          </button>
        )}
      </div>

      <Reorder.Group
        axis="y"
        values={panels}
        // Local only. The write is on release — see `draft` above.
        onReorder={setDraft}
        style={{ listStyle: 'none', margin: 0, padding: 0 }}
      >
        {panels.map((panel) => (
          <PanelRow
            key={panel.id}
            panel={panel}
            position={positions.get(panel.id) ?? null}
            // The last one on cannot be switched off: the notch would have no
            // card to draw and no arrow to reach one with, and the only way back
            // would be this window. `resolvePanels` catches it a second time for
            // a hand-edited file.
            canHide={visibleCount > 1}
            onToggle={() => toggle(panel.id)}
            onDragStart={() => {
              dragging.current = true
            }}
            onDragEnd={() => {
              dragging.current = false
              // From the ref, not the closure: this handler was created on the
              // render that started the drag, and `draft` has moved several
              // times since.
              commit(draftRef.current)
            }}
          />
        ))}
      </Reorder.Group>
    </div>
  )
}
